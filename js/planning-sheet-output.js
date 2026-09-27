(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningSheetOutput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    function dateParts(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return { year, month, day, date };
    }

    function latestPeriod(schedule) {
        const rows = Array.isArray(schedule) ? schedule : [];
        const activeRows = rows.filter(row => Number(row && row.productionAmount || 0) > 0 && displaySize(row && row.size) !== '休止');
        const periods = (activeRows.length ? activeRows : rows)
            .map(row => dateParts(row && row.date))
            .filter(Boolean)
            .sort((left, right) => left.date - right.date);
        const latest = periods[periods.length - 1];
        return latest ? { year: latest.year, month: latest.month } : null;
    }

    function samePeriod(value, period) {
        const parts = dateParts(value);
        return Boolean(parts && period && parts.year === period.year && parts.month === period.month);
    }

    function normalizeTeam(value) {
        const token = String(value || '').normalize('NFKC').trim().toUpperCase();
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
        const token = String(value || '').normalize('NFKC').trim().toUpperCase();
        if (token === 'STOP' || /休止|休み/.test(token)) return '休止';
        return /^D\d+$/.test(token) ? token : '';
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

    function suggestionColumn(slot) {
        const team = normalizeTeam(slot && slot.team);
        if (team === 'A') return 'E';
        if (team === 'B') return 'H';
        return 'K';
    }

    function buildSizeChangeSuggestions(sizeChanges, period) {
        return (Array.isArray(sizeChanges) ? sizeChanges : []).flatMap(entry => {
            const change = entry && entry.change ? entry.change : entry || {};
            if (!samePeriod(change.toDate, period)) return [];
            const recommendation = entry && entry.recommendation;
            const slot = recommendation && recommendation.slot;
            const date = slot && samePeriod(slot.date, period) ? slot.date : change.toDate;
            return [{
                kind: 'sizeChange',
                date,
                column: slot ? suggestionColumn(slot) : 'K',
                text: 'サイズ替（自動案）',
                status: slot ? 'candidate' : 'review',
                fromSize: displaySize(change.fromSize),
                toSize: displaySize(change.toSize)
            }];
        });
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
            suggestions: buildSizeChangeSuggestions(planning.sizeChanges, period),
            capabilities: {
                sizeChangeConnected: true,
                caliberConnected: Boolean(planning.caliberConnected)
            }
        };
    }

    return {
        dateParts,
        latestPeriod,
        displaySize,
        buildCalendarRows,
        buildSizeChangeSuggestions,
        buildExportPayload
    };
});
