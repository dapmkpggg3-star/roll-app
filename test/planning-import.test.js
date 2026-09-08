const test = require('node:test');
const assert = require('node:assert/strict');
const importer = require('../js/planning-import');
const rules = require('../js/planning-rules');
const scheduleApi = require('../js/planning-schedule');

function uint16(value) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
}

function uint32(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0);
    return buffer;
}

function storedZip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    Object.entries(files).forEach(([name, content]) => {
        const nameBytes = Buffer.from(name);
        const data = Buffer.from(content);
        const local = Buffer.concat([
            uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
            uint32(0), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0),
            nameBytes, data
        ]);
        const central = Buffer.concat([
            uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
            uint32(0), uint32(data.length), uint32(data.length), uint16(nameBytes.length), uint16(0),
            uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes
        ]);
        locals.push(local);
        centrals.push(central);
        offset += local.length;
    });
    const central = Buffer.concat(centrals);
    const end = Buffer.concat([
        uint32(0x06054b50), uint16(0), uint16(0), uint16(centrals.length), uint16(centrals.length),
        uint32(central.length), uint32(offset), uint16(0)
    ]);
    return Buffer.concat([...locals, central, end]);
}

function sharedCell(ref, index) {
    return `<c r="${ref}" t="s"><v>${index}</v></c>`;
}

function numberCell(ref, value) {
    return `<c r="${ref}"><v>${value}</v></c>`;
}

function sampleWorksheet() {
    const rows = [];
    for (let day = 1; day <= 30; day += 1) {
        const row = day + 15;
        const sizeIndex = day === 1 ? 1 : day === 3 ? 2 : 0;
        const aAmount = day === 1 ? 100 : 0;
        const bAmount = day === 3 ? 100 : 0;
        rows.push(`<row r="${row}"><c r="A${row}"/>${[
            numberCell(`D${row}`, day),
            sharedCell(`G${row}`, sizeIndex),
            sharedCell(`H${row}`, day === 1 ? 3 : 4),
            sharedCell(`I${row}`, day === 1 ? 4 : 3),
            numberCell(`J${row}`, aAmount + bAmount),
            numberCell(`L${row}`, aAmount),
            numberCell(`N${row}`, bAmount)
        ].join('')}</row>`);
    }
    return `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function sampleMaintenanceWorksheet() {
    const rows = [];
    for (let day = 1; day <= 30; day += 1) {
        const row = day + 4;
        rows.push(`<row r="${row}"><c r="A${row}"/>${[
            numberCell(`B${row}`, day),
            day === 2 ? sharedCell(`K${row}`, 5) : ''
        ].join('')}</row>`);
    }
    return `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function sampleWorkbookBuffer() {
    const sharedStrings = ['休止', 'D1', 'D2', 'A', 'B', 'ロール替'];
    return storedZip({
        'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="31.04 生産予定" sheetId="1" r:id="rId1"/><sheet name="2031.4 ロールカリバ替予定" sheetId="2" r:id="rId2"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
        'xl/sharedStrings.xml': `<?xml version="1.0"?><sst>${sharedStrings.map(value => `<si><t>${value}</t></si>`).join('')}</sst>`,
        'xl/worksheets/sheet1.xml': sampleWorksheet(),
        'xl/worksheets/sheet2.xml': sampleMaintenanceWorksheet()
    });
}

test('year and month are read only from production-plan sheet names', () => {
    assert.deepEqual(importer.parseYearMonth('31.04 生産予定'), { year: 2031, month: 4 });
    assert.deepEqual(importer.parseYearMonth('2032年12月 生産予定'), { year: 2032, month: 12 });
    assert.equal(importer.parseYearMonth('2031.4 ロールカリバ替予定'), null);
    assert.deepEqual(importer.parseMaintenanceYearMonth('2031.4 ロールカリバ替予定'), { year: 2031, month: 4 });
});

test('production rows are extracted from the longest sequential day block', () => {
    const shared = ['休止', 'D1', 'D2', 'A', 'B'];
    const rows = importer.parseProductionWorksheet(sampleWorksheet(), shared, '31.04 生産予定');
    assert.equal(rows.length, 30);
    assert.deepEqual(rows[0], {
        date: '2031-04-01',
        size: 'D1',
        productionAmount: 100,
        productionByTeam: { A: 100, B: 0 },
        shift1Team: 'A',
        shift3Team: 'B',
        jointMaintenance: false
    });
    assert.equal(rows[1].size, 'STOP');
    assert.equal(rows[2].size, 'D2');
});

test('a complete xlsx zip is parsed without uploading or external libraries', async () => {
    const buffer = sampleWorkbookBuffer();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const parsed = await importer.parseXlsxArrayBuffer(arrayBuffer);
    assert.equal(parsed.importedSheets.length, 1);
    assert.equal(parsed.maintenanceSheets.length, 1);
    assert.equal(parsed.schedule.length, 30);
    assert.deepEqual(parsed.schedule[1].requiredWorks, [{ type: 'rollChange' }]);
    const planning = importer.createPlanningResults(parsed.schedule, { rules, schedule: scheduleApi });
    assert.equal(planning.caliberConnected, false);
    assert.equal(planning.sizeChanges.length, 1);
    assert.equal(planning.sizeChanges[0].change.fromSize, 'D1');
    assert.equal(planning.sizeChanges[0].change.toSize, 'D2');
    assert.equal(planning.sizeChanges[0].recommendation.slot.shift, 'shift1');
});

test('xml entities and rich shared strings are decoded', () => {
    assert.equal(importer.decodeXml('A&amp;B&#x30FB;C'), 'A&B・C');
    assert.deepEqual(
        importer.parseSharedStrings('<sst><si><r><t>D</t></r><r><t>1</t></r></si></sst>'),
        ['D1']
    );
});
