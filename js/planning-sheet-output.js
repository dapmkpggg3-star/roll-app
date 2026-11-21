(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningSheetOutput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    function dateParts(value) {
        if (typeof value !== 'string') return null;
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return { year, month, day, date };
    }

    function productionAmountState(amount) {
        if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) return amount > 0 ? 'positive' : 'zero';
        return 'unknown';
    }

    function laterAmountUnconfirmed(schedule, period) {
        if (!period || !Number.isInteger(period.year) || !Number.isInteger(period.month)) return true;
        return (Array.isArray(schedule) ? schedule : []).some(row => {
            const parts = dateParts(row && row.date);
            // An unparseable date cannot establish that unknown production belongs to a safe month.
            if (!parts && productionAmountState(row && row.productionAmount) === 'unknown') return true;
            const raw = row && row.date;
            // Malformed future-month rows must not conceal unknown production.
            const prefix = typeof raw === 'string' ? raw.match(/^(\d{4})-(\d{1,2})-/) : null;
            const year = parts ? parts.year : prefix ? Number(prefix[1]) : null;
            const month = parts ? parts.month : prefix ? Number(prefix[2]) : null;
            const later = year !== null && (year > period.year || (year === period.year && month > period.month));
            return later && (!parts || productionAmountState(row && row.productionAmount) === 'unknown');
        });
    }

    function latestPeriod(schedule) {
        const rows = (Array.isArray(schedule) ? schedule : [])
            .map(row => ({ row, parts: dateParts(row && row.date) }))
            .filter(item => item.parts)
            .sort((left, right) => left.parts.date - right.parts.date);
        let lastPositive = null;
        let unknownLaterMonth = false;
        rows.forEach(item => {
            const state = productionAmountState(item.row.productionAmount);
            if (state === 'unknown') {
                if (lastPositive && (item.parts.year !== lastPositive.year || item.parts.month !== lastPositive.month)) {
                    unknownLaterMonth = true;
                }
                return;
            }
            if (state === 'positive' && displaySize(item.row.size) !== '休止') {
                lastPositive = item.parts;
                unknownLaterMonth = false;
            }
        });
        if (!lastPositive || unknownLaterMonth) return null;
        return { year: lastPositive.year, month: lastPositive.month };
    }

    function samePeriod(value, period) {
        const parts = dateParts(value);
        return Boolean(parts && period && parts.year === period.year && parts.month === period.month);
    }

    function normalizeTeam(value) {
        if (typeof value !== 'string') return '';
        const token = value.normalize('NFKC').trim().toUpperCase();
        return token === 'A' || token === 'B' ? token : '';
    }

    function shiftForTeam(row, team) {
        const requested = normalizeTeam(team);
        if (!requested) return '';
        if (normalizeTeam(row && row.shift1Team) === requested) return 'Ⅰ';
        if (normalizeTeam(row && row.shift3Team) === requested) return 'Ⅲ';
        return '';
    }

    function displaySize(value) {
        if (typeof value !== 'string') return '';
        const token = String(value || '').normalize('NFKC').trim().toUpperCase();
        if (token === 'STOP' || token === '休止' || token === '休み') return '休止';
        return /^D\d+$/.test(token) ? token : '';
    }

    function invalidPeriodReason(period) {
        if (!period || !Number.isInteger(period.year) || !Number.isInteger(period.month)) return '出力する年月の指定が不正です。';
        if (period.month < 1 || period.month > 12) return '出力する年月の指定が不正です。';
        return '';
    }

    function claimsPeriod(raw, period) {
        const text = String(raw || '');
        if (text.startsWith(`${period.year}-${String(period.month).padStart(2, '0')}`)) return true;
        const match = text.match(/^(\d{4})(?:[-/._\s]|年)\s*(\d{1,2})(?=[-/._\s]|月|$)/);
        return Boolean(match && Number(match[1]) === period.year && Number(match[2]) === period.month);
    }

    function outputMonthReason(schedule, period) {
        const rows = (Array.isArray(schedule) ? schedule : []).filter(row => claimsPeriod(row && row.date, period));
        const seen = new Set();
        const days = [];
        for (const row of rows) {
            const parts = dateParts(row && row.date);
            if (!parts || parts.year !== period.year || parts.month !== period.month) {
                return '出力対象月の日付を確認できない行があるので、出力する年月を確定できません。';
            }
            if (seen.has(parts.day)) return '同じ日付が重なっているので、出力する年月を確定できません。';
            seen.add(parts.day);
            days.push(parts.day);
            if (productionAmountState(row.productionAmount) === 'unknown') {
                return '出力対象月の生産量が未確認なので、出力する年月を確定できません。';
            }
            if (!displaySize(row.size)) return '出力対象月のサイズが未確認なので、出力する年月を確定できません。';
            if (!normalizeTeam(row.shift1Team) && !normalizeTeam(row.shift3Team)) {
                return '出力対象月の班が未確認なので、出力する年月を確定できません。';
            }
        }
        days.sort((left, right) => left - right);
        for (let index = 1; index < days.length; index += 1) {
            if (days[index] !== days[index - 1] + 1) {
                return '出力対象月の日付行が抜けているので、出力する年月を確定できません。';
            }
        }
        return '';
    }

    function buildCalendarRows(schedule, period) {
        return (Array.isArray(schedule) ? schedule : [])
            .filter(row => samePeriod(row && row.date, period))
            .map(row => {
                const parts = dateParts(row.date);
                return {
                    date: row.date,
                    day: parts.day,
                    weekday: WEEKDAYS[parts.date.getUTCDay()],
                    size: displaySize(row.size),
                    operationAShift: shiftForTeam(row, 'A'),
                    operationBShift: shiftForTeam(row, 'B')
                };
            })
            .sort((left, right) => left.day - right.day);
    }

    // Work-column mapping is not approved. Never emit an E/H/K proposal.
    function buildSizeChangeSuggestions() {
        return [];
    }

    function requestId(now, random) {
        const timestamp = Number.isFinite(now) ? now : Date.now();
        const suffix = Math.floor((Number.isFinite(random) ? random : Math.random()) * 0xFFFFFF)
            .toString(16).padStart(6, '0');
        return `planning-${timestamp}-${suffix}`;
    }

    function buildExportPayload(parsed, options) {
        const schedule = Array.isArray(parsed && parsed.schedule) ? parsed.schedule : [];
        const period = options && options.period ? options.period : latestPeriod(schedule);
        if (!period) throw new Error('出力する生産予定の年月を確認できませんでした。');
        const invalidPeriod = invalidPeriodReason(period);
        if (invalidPeriod) throw new Error(invalidPeriod);
        if (laterAmountUnconfirmed(schedule, period)) {
            throw new Error('後の月の生産量が未確認なので、出力する年月を確定できません。');
        }
        const monthReason = outputMonthReason(schedule, period);
        if (monthReason) throw new Error(monthReason);
        const planning = parsed && parsed.planning ? parsed.planning : {};
        const calendarRows = buildCalendarRows(schedule, period);
        if (!calendarRows.length) throw new Error('出力対象月の生産予定がありません。');
        const generatedAt = planning.generatedAt || new Date().toISOString();
        return {
            requestId: requestId(options && options.now, options && options.random),
            year: period.year,
            month: period.month,
            sheetName: `${period.year}.${period.month} ロールカリバ替予定`,
            generatedAt,
            sourceSheets: Array.isArray(parsed.importedSheets) ? parsed.importedSheets.slice(0, 24) : [],
            calendarRows,
            // Column mapping for work suggestions is not verified: E/H contain team data.
            // Fail closed at the payload boundary until an approved cell contract exists.
            suggestions: [],
            capabilities: {
                sizeChangeConnected: true,
                caliberConnected: Boolean(planning.caliberConnected)
            }
        };
    }

    return {
        dateParts,
        latestPeriod,
        laterAmountUnconfirmed,
        displaySize,
        buildCalendarRows,
        buildSizeChangeSuggestions,
        buildExportPayload
    };
});

