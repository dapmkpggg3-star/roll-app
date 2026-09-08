(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const MAX_FILE_BYTES = 50 * 1024 * 1024;
    const MAX_UNCOMPRESSED_BYTES = 120 * 1024 * 1024;
    const REQUIRED_COLUMNS = new Set(['B', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'N', 'P', 'X']);
    const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

    function decodeXml(value) {
        return String(value == null ? '' : value)
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
            .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    function normalizeZipPath(value) {
        const parts = [];
        String(value || '').replace(/^\/+/, '').split('/').forEach(part => {
            if (!part || part === '.') return;
            if (part === '..') parts.pop();
            else parts.push(part);
        });
        return parts.join('/');
    }

    function findEndOfCentralDirectory(view) {
        const signature = 0x06054b50;
        const start = Math.max(0, view.byteLength - 65557);
        for (let offset = view.byteLength - 22; offset >= start; offset -= 1) {
            if (view.getUint32(offset, true) === signature) return offset;
        }
        throw new Error('ExcelファイルのZIP構造を確認できませんでした。');
    }

    async function inflateRaw(bytes) {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('このブラウザはExcel展開に対応していません。ChromeまたはEdgeの最新版で開いてください。');
        }
        let stream;
        try {
            stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        } catch (_) {
            throw new Error('このブラウザはExcel展開に対応していません。ChromeまたはEdgeの最新版で開いてください。');
        }
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function extractZipEntries(arrayBuffer) {
        if (!textDecoder) throw new Error('文字コードの読み取りに対応していないブラウザです。');
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const eocd = findEndOfCentralDirectory(view);
        const entryCount = view.getUint16(eocd + 10, true);
        const centralOffset = view.getUint32(eocd + 16, true);
        const entries = new Map();
        const records = [];
        let totalUncompressed = 0;
        let offset = centralOffset;

        for (let index = 0; index < entryCount; index += 1) {
            if (view.getUint32(offset, true) !== 0x02014b50) {
                throw new Error('Excelファイルの一覧情報が壊れています。');
            }
            const method = view.getUint16(offset + 10, true);
            const compressedSize = view.getUint32(offset + 20, true);
            const uncompressedSize = view.getUint32(offset + 24, true);
            const fileNameLength = view.getUint16(offset + 28, true);
            const extraLength = view.getUint16(offset + 30, true);
            const commentLength = view.getUint16(offset + 32, true);
            const localOffset = view.getUint32(offset + 42, true);
            const name = normalizeZipPath(textDecoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength)));
            totalUncompressed += uncompressedSize;
            if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
                throw new Error('Excelの展開サイズが大きすぎるため読み込めません。');
            }
            records.push({ name, method, compressedSize, uncompressedSize, localOffset });
            offset += 46 + fileNameLength + extraLength + commentLength;
        }

        for (const record of records) {
            if (!record.name || record.name.endsWith('/')) continue;
            const local = record.localOffset;
            if (view.getUint32(local, true) !== 0x04034b50) {
                throw new Error('Excelファイル内のデータ位置を確認できませんでした。');
            }
            const localNameLength = view.getUint16(local + 26, true);
            const localExtraLength = view.getUint16(local + 28, true);
            const dataStart = local + 30 + localNameLength + localExtraLength;
            const compressed = bytes.subarray(dataStart, dataStart + record.compressedSize);
            let content;
            if (record.method === 0) content = compressed.slice();
            else if (record.method === 8) content = await inflateRaw(compressed);
            else throw new Error(`未対応のExcel圧縮方式です（方式${record.method}）。`);
            if (record.uncompressedSize && content.byteLength !== record.uncompressedSize) {
                throw new Error('Excelファイルの展開結果が一致しませんでした。');
            }
            entries.set(record.name, content);
        }
        return entries;
    }

    function entryText(entries, path, required) {
        const bytes = entries.get(normalizeZipPath(path));
        if (!bytes) {
            if (required) throw new Error(`Excel内の必要ファイルがありません: ${path}`);
            return '';
        }
        return textDecoder.decode(bytes);
    }

    function attribute(source, name) {
        const match = String(source || '').match(new RegExp(`(?:^|\\s)${name.replace(':', '\\:')}="([^"]*)"`));
        return match ? decodeXml(match[1]) : '';
    }

    function parseSharedStrings(xml) {
        const values = [];
        const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
        let item;
        while ((item = itemPattern.exec(xml))) {
            const runs = [];
            const textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
            let part;
            while ((part = textPattern.exec(item[1]))) runs.push(decodeXml(part[1]));
            values.push(runs.join(''));
        }
        return values;
    }

    function parseWorkbookSheets(workbookXml, relationshipsXml) {
        const targets = new Map();
        const relationshipPattern = /<Relationship\b([^>]*)\/?\s*>/g;
        let relationship;
        while ((relationship = relationshipPattern.exec(relationshipsXml))) {
            const id = attribute(relationship[1], 'Id');
            const target = attribute(relationship[1], 'Target');
            if (id && target) {
                targets.set(id, normalizeZipPath(target.startsWith('/') ? target : `xl/${target}`));
            }
        }

        const sheets = [];
        const sheetPattern = /<sheet\b([^>]*)\/?\s*>/g;
        let sheet;
        while ((sheet = sheetPattern.exec(workbookXml))) {
            const name = attribute(sheet[1], 'name');
            const relationshipId = attribute(sheet[1], 'r:id');
            const path = targets.get(relationshipId);
            if (name && path) sheets.push({ name, path });
        }
        return sheets;
    }

    function cellText(body) {
        const chunks = [];
        const pattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let match;
        while ((match = pattern.exec(body))) chunks.push(decodeXml(match[1]));
        return chunks.join('');
    }

    function parseWorksheetCells(xml, sharedStrings) {
        const rows = new Map();
        const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
        let cell;
        while ((cell = cellPattern.exec(xml))) {
            const ref = attribute(cell[1], 'r').toUpperCase();
            const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
            if (!refMatch || !REQUIRED_COLUMNS.has(refMatch[1])) continue;
            const type = attribute(cell[1], 't');
            const body = cell[2] || '';
            const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
            let value = '';
            if (type === 'inlineStr') value = cellText(body);
            else if (valueMatch) {
                const raw = decodeXml(valueMatch[1]);
                if (type === 's') value = sharedStrings[Number(raw)] ?? '';
                else if (type === 'b') value = raw === '1';
                else if (type === 'str') value = raw;
                else if (type !== 'e') {
                    const numeric = Number(raw);
                    value = raw !== '' && Number.isFinite(numeric) ? numeric : raw;
                }
            }
            const rowNumber = Number(refMatch[2]);
            if (!rows.has(rowNumber)) rows.set(rowNumber, {});
            rows.get(rowNumber)[refMatch[1]] = value;
        }
        return rows;
    }

    function parseYearMonth(sheetName) {
        if (!/生産予定/.test(String(sheetName || ''))) return null;
        const normalized = String(sheetName).normalize('NFKC');
        const match = normalized.match(/(\d{2,4})\s*(?:[.\-/]|年)\s*(\d{1,2})(?:\s*月)?/);
        if (!match) return null;
        let year = Number(match[1]);
        const month = Number(match[2]);
        if (year < 100) year += year >= 80 ? 1900 : 2000;
        if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
        return { year, month };
    }

    function parseMaintenanceYearMonth(sheetName) {
        if (!/ロールカリバ替予定/.test(String(sheetName || ''))) return null;
        const normalized = String(sheetName).normalize('NFKC');
        const match = normalized.match(/(\d{2,4})\s*(?:[.\-/]|年)\s*(\d{1,2})(?:\s*月)?/);
        if (!match) return null;
        let year = Number(match[1]);
        const month = Number(match[2]);
        if (year < 100) year += year >= 80 ? 1900 : 2000;
        if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
        return { year, month };
    }

    function asNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const numeric = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function normalizeTeam(value) {
        const token = String(value == null ? '' : value).normalize('NFKC').trim().toUpperCase().replace(/班/g, '');
        return token === 'A' || token === 'B' ? token : '';
    }

    function normalizeSize(value, productionAmount) {
        const token = String(value == null ? '' : value).normalize('NFKC').toUpperCase().replace(/\s+/g, '');
        if (/^D\d+(?:\.0)?$/.test(token)) return token.replace(/\.0$/, '');
        if (/休止|休み|STOP/.test(token) || asNumber(productionAmount) === 0) return 'STOP';
        return '';
    }

    function findDaySequence(rows, year, month, dayColumn) {
        const column = dayColumn || 'D';
        const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const candidates = [...rows.entries()]
            .map(([rowNumber, cells]) => ({ rowNumber, day: asNumber(cells[column]), cells }))
            .filter(item => Number.isInteger(item.day) && item.day >= 1 && item.day <= maxDay)
            .sort((a, b) => a.rowNumber - b.rowNumber);
        const sequences = [];
        let current = [];
        for (const item of candidates) {
            const previous = current[current.length - 1];
            if (!previous || (item.rowNumber === previous.rowNumber + 1 && item.day === previous.day + 1)) current.push(item);
            else {
                if (current.length) sequences.push(current);
                current = [item];
            }
        }
        if (current.length) sequences.push(current);
        sequences.sort((a, b) => b.length - a.length);
        const best = sequences[0] || [];
        return best.length >= Math.min(20, maxDay) ? best : [];
    }

    function isoDate(year, month, day) {
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function isWeekday(year, month, day) {
        const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
        return weekday >= 1 && weekday <= 5;
    }

    function parseProductionWorksheet(xml, sharedStrings, sheetName) {
        const period = parseYearMonth(sheetName);
        if (!period) return [];
        const rows = parseWorksheetCells(xml, sharedStrings);
        const dayRows = findDaySequence(rows, period.year, period.month);
        return dayRows.map(item => {
            const cells = item.cells;
            const aProduction = asNumber(cells.L);
            const bProduction = asNumber(cells.N);
            const statedTotal = asNumber(cells.J);
            const productionAmount = statedTotal || aProduction + bProduction;
            const shift1Team = normalizeTeam(cells.H);
            const shift3Team = normalizeTeam(cells.I);
            const productionByTeam = { A: aProduction, B: bProduction };
            return {
                date: isoDate(period.year, period.month, item.day),
                size: normalizeSize(cells.G, productionAmount),
                productionAmount,
                productionByTeam,
                shift1Team,
                shift3Team,
                jointMaintenance: isWeekday(period.year, period.month, item.day)
                    && Boolean(shift1Team)
                    && asNumber(productionByTeam[shift1Team]) === 0
            };
        });
    }

    function maintenanceWorkTypes(value) {
        const text = String(value == null ? '' : value).normalize('NFKC');
        const works = [];
        if (/ロール替/.test(text)) works.push({ type: 'rollChange' });
        if (/カリバ替/.test(text)) works.push({ type: 'caliberChange' });
        return works;
    }

    function parseMaintenanceWorksheet(xml, sharedStrings, sheetName) {
        const period = parseMaintenanceYearMonth(sheetName);
        if (!period) return [];
        const rows = parseWorksheetCells(xml, sharedStrings);
        const dayRows = findDaySequence(rows, period.year, period.month, 'B');
        return dayRows.map(item => ({
            date: isoDate(period.year, period.month, item.day),
            requiredWorks: ['E', 'H', 'K', 'N'].flatMap(column => maintenanceWorkTypes(item.cells[column]))
        }));
    }

    async function parseXlsxArrayBuffer(arrayBuffer) {
        const entries = await extractZipEntries(arrayBuffer);
        const workbookXml = entryText(entries, 'xl/workbook.xml', true);
        const relationshipsXml = entryText(entries, 'xl/_rels/workbook.xml.rels', true);
        const sharedStrings = parseSharedStrings(entryText(entries, 'xl/sharedStrings.xml', false));
        const sheets = parseWorkbookSheets(workbookXml, relationshipsXml);
        const productionSheets = sheets.filter(sheet => parseYearMonth(sheet.name));
        if (!productionSheets.length) {
            throw new Error('「生産予定」という名前の月別シートが見つかりませんでした。');
        }

        const productionPeriods = new Set(productionSheets.map(sheet => {
            const period = parseYearMonth(sheet.name);
            return `${period.year}-${period.month}`;
        }));
        const maintenanceByDate = new Map();
        const maintenanceSheets = [];
        for (const sheet of sheets.filter(item => parseMaintenanceYearMonth(item.name))) {
            const period = parseMaintenanceYearMonth(sheet.name);
            if (!productionPeriods.has(`${period.year}-${period.month}`)) continue;
            const xml = entryText(entries, sheet.path, false);
            if (!xml) continue;
            const rows = parseMaintenanceWorksheet(xml, sharedStrings, sheet.name);
            if (!rows.length) continue;
            maintenanceSheets.push(sheet.name);
            rows.forEach(row => maintenanceByDate.set(row.date, row.requiredWorks));
        }

        const schedule = [];
        const importedSheets = [];
        for (const sheet of productionSheets) {
            const xml = entryText(entries, sheet.path, false);
            if (!xml) continue;
            const rows = parseProductionWorksheet(xml, sharedStrings, sheet.name);
            if (!rows.length) continue;
            importedSheets.push(sheet.name);
            schedule.push(...rows.map(row => ({
                ...row,
                requiredWorks: maintenanceByDate.get(row.date) || []
            })));
        }
        if (!schedule.length) {
            throw new Error('生産予定の日付行を確認できませんでした。対象のExcelか確認してください。');
        }

        const byDate = new Map();
        schedule.forEach(row => byDate.set(row.date, row));
        const sortedSchedule = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        return { schedule: sortedSchedule, importedSheets, maintenanceSheets };
    }

    function createPlanningResults(schedule, dependencies) {
        const rulesApi = dependencies && dependencies.rules;
        const scheduleApi = dependencies && dependencies.schedule;
        if (!rulesApi || !scheduleApi) throw new Error('自動計画モジュールを読み込めませんでした。');
        const ruleEngine = rulesApi.createPlanningRules({
            preferStoppedShift: true,
            preferSameTeam: true,
            stoppedShiftWeight: 1,
            sameTeamWeight: 2,
            jointMaintenanceWeight: 3
        });
        return {
            generatedAt: new Date().toISOString(),
            sizeChanges: scheduleApi.recommendSizeChanges(schedule, ruleEngine, rulesApi.SLOT_TYPES),
            caliberChanges: [],
            caliberConnected: false
        };
    }

    function setStatus(message, state) {
        if (typeof document === 'undefined') return;
        const status = document.getElementById('auto-planning-import-status');
        if (!status) return;
        status.textContent = message || '';
        status.classList.toggle('is-success', state === 'success');
        status.classList.toggle('is-error', state === 'error');
    }

    function setSummary(result) {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('auto-planning-source-summary');
        const detail = document.getElementById('auto-planning-source-detail');
        if (!container || !detail) return;
        const schedule = result && result.schedule ? result.schedule : [];
        if (!schedule.length) {
            container.hidden = true;
            detail.textContent = '';
            return;
        }
        const from = schedule[0].date;
        const to = schedule[schedule.length - 1].date;
        const maintenanceCount = Array.isArray(result.maintenanceSheets) ? result.maintenanceSheets.length : 0;
        const maintenanceText = maintenanceCount ? `／作業予定${maintenanceCount}シート` : '';
        detail.textContent = `生産予定${result.importedSheets.length}シート${maintenanceText}・${schedule.length}日分（${from}～${to}）`;
        container.hidden = false;
    }

    async function importFile(file, dependencies) {
        if (!file) return null;
        const extension = String(file.name || '').toLowerCase();
        if (!/\.(xlsx|xlsm)$/.test(extension)) {
            throw new Error('読み込めるのは .xlsx または .xlsm ファイルです。');
        }
        if (file.size > MAX_FILE_BYTES) throw new Error('Excelファイルが50MBを超えています。');
        const buffer = await file.arrayBuffer();
        const parsed = await parseXlsxArrayBuffer(buffer);
        const planning = createPlanningResults(parsed.schedule, dependencies);
        return { ...parsed, planning };
    }

    function clearImportedData(viewApi) {
        if (viewApi && typeof viewApi.setData === 'function') viewApi.setData({}, { persist: false });
        try { localStorage.removeItem('rollPlanningPreview'); } catch (_) {}
        setSummary(null);
        setStatus('', '');
        const input = typeof document !== 'undefined' ? document.getElementById('auto-planning-file') : null;
        if (input) input.value = '';
    }

    function initialize() {
        if (typeof document === 'undefined') return;
        const zone = document.getElementById('auto-planning-drop-zone');
        const input = document.getElementById('auto-planning-file');
        const button = document.getElementById('auto-planning-file-button');
        const clearButton = document.getElementById('auto-planning-clear');
        if (!zone || !input || !button || zone.dataset.initialized === 'true') return;
        zone.dataset.initialized = 'true';
        const dependencies = {
            rules: globalThis.RollPlanningRules,
            schedule: globalThis.RollPlanningSchedule
        };
        const viewApi = globalThis.RollPlanningView;

        async function process(file) {
            setStatus('Excelを端末内で読み取っています…', '');
            zone.classList.remove('is-dragging');
            try {
                const result = await importFile(file, dependencies);
                if (!result) return;
                if (!viewApi || typeof viewApi.setData !== 'function') throw new Error('表示モジュールを読み込めませんでした。');
                try { localStorage.removeItem('rollPlanningPreview'); } catch (_) {}
                viewApi.setData(result.planning, { persist: false });
                viewApi.setOpen(true);
                setSummary(result);
                setStatus(`読み込み完了：サイズ替候補 ${result.planning.sizeChanges.length}件（カリバ替は未接続）`, 'success');
            } catch (error) {
                setSummary(null);
                setStatus(error && error.message ? error.message : 'Excelを読み込めませんでした。', 'error');
            }
        }

        button.addEventListener('click', event => {
            event.stopPropagation();
            input.click();
        });
        zone.addEventListener('click', event => {
            if (event.target !== button) input.click();
        });
        zone.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                input.click();
            }
        });
        input.addEventListener('change', () => process(input.files && input.files[0]));
        ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
            event.preventDefault();
            zone.classList.add('is-dragging');
        }));
        ['dragleave', 'dragend'].forEach(type => zone.addEventListener(type, () => zone.classList.remove('is-dragging')));
        zone.addEventListener('drop', event => {
            event.preventDefault();
            const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
            process(file);
        });
        if (clearButton) clearButton.addEventListener('click', () => clearImportedData(viewApi));
    }

    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initialize);

    return {
        decodeXml,
        extractZipEntries,
        parseSharedStrings,
        parseWorkbookSheets,
        parseWorksheetCells,
        parseYearMonth,
        parseMaintenanceYearMonth,
        findDaySequence,
        parseProductionWorksheet,
        parseMaintenanceWorksheet,
        parseXlsxArrayBuffer,
        createPlanningResults,
        importFile,
        initialize
    };
});
