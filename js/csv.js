function parseCsv(csvText) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        if (inQuotes) {
            if (char === '"') {
                if (csvText[i + 1] === '"') {
                    value += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                value += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(value);
                value = '';
            } else if (char === '\r') {
                continue;
            } else if (char === '\n') {
                row.push(value);
                rows.push(row);
                row = [];
                value = '';
            } else {
                value += char;
            }
        }
    }
    if (value !== '' || row.length > 0) {
        row.push(value);
        rows.push(row);
    }
    return rows;
}

function importCsv(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            let text = e.target.result;
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }
            const rows = parseCsv(text).filter(row => row.length > 0 && row.some(cell => cell.trim() !== ''));
            if (rows.length === 0) {
                alert('CSVにデータがありません');
                return;
            }
            const header = rows[0].map(cell => cell.trim().toLowerCase());
            let startIndex = 0;
            if (header[0] && header[0].includes('id') && header[1] && (header[1].includes('スタンド') || header[1].includes('name'))) {
                startIndex = 1;
            }
            const hasStatusColumn = header.some(cell => cell.includes('ステータス') || cell.includes('status'));
            const importedRoles = [];
            for (let i = startIndex; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 2) {
                    continue;
                }
                const rawId = parseInt(row[0].trim(), 10);
                const name = row[1].trim();
                const rawStatus = hasStatusColumn ? (row[2] ? row[2].trim() : 'オンライン') : 'オンライン';
                const status = rawStatus === '廃却待ち' ? '廃却待ち（ラック保管）' : rawStatus;
                const memo = hasStatusColumn ? (row[3] ? row[3].trim() : '') : (row[2] ? row[2].trim() : '');
                const updatedAt = hasStatusColumn ? (row[4] ? row[4].trim() : new Date().toISOString()) : (row[3] ? row[3].trim() : new Date().toISOString());
                if (!name) {
                    continue;
                }
                const validStatuses = ['オンライン', '中古予備（バラシ前）', '改削行き（搬出可能）', '改削中', '新品予備（組替可能）', '新品予備（組込完了）', '新品予備保管', '発注済み（納入待ち）', '廃却待ち（ラック保管）', '廃棄'];
                if (!validStatuses.includes(status)) {
                    continue;
                }
                importedRoles.push({ id: isNaN(rawId) ? null : rawId, name, status, memo, updatedAt, history: [] });
            }
            if (importedRoles.length === 0) {
                alert('有効なロールデータがありません');
                return;
            }
            let maxId = nextId - 1;
            importedRoles.forEach(role => {
                if (!role.id || role.id <= 0 || isNaN(role.id)) {
                    role.id = ++maxId;
                } else if (role.id > maxId) {
                    maxId = role.id;
                }
            });
            roles = importedRoles;
            nextId = maxId + 1;
            fixOnlineDuplicates();
            saveLocalRoles();
            renderRoles();
            syncRoles();
            alert('CSVからロールを読み込みました');
        } catch (error) {
            alert('CSVの読み込みに失敗しました: ' + error.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function exportCsv() {
    if (roles.length === 0) {
        alert('エクスポートするロールがありません');
        return;
    }
    const headers = ['ID', 'スタンド番号', 'ステータス', 'メモ', '最終更新日'];
    const rows = roles.map(role => [
        role.id,
        role.name,
        role.status || '',
        role.memo || '',
        role.updatedAt
    ]);
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roles.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
