const test = require('node:test');
const assert = require('node:assert/strict');
const importer = require('../js/planning-import');
const rules = require('../js/planning-rules');
const scheduleApi = require('../js/planning-schedule');

// Anonymous column-role fixtures. Letters below are layout labels for the test,
// not a transcription of a factory workbook.
const SHARED = ['A班', 'B班', 'カリバ替', 'ロール替', 'ロール替／カリバ替'];

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

function maintenanceSheetXml() {
    const rows = [];
    for (let day = 1; day <= 20; day += 1) {
        const row = day + 4;
        const cells = [numberCell(`B${row}`, day)];
        if (day === 2) {
            cells.push(sharedCell(`E${row}`, 0), sharedCell(`H${row}`, 1), sharedCell(`K${row}`, 2), sharedCell(`N${row}`, 3));
        } else if (day === 3) {
            cells.push(sharedCell(`E${row}`, 3), sharedCell(`H${row}`, 0));
        } else if (day === 4) {
            cells.push(sharedCell(`E${row}`, 0), sharedCell(`H${row}`, 1), sharedCell(`K${row}`, 4));
        }
        rows.push(`<row r="${row}">${cells.join('')}</row>`);
    }
    return `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function productionSheetXml() {
    const rows = [];
    for (let day = 1; day <= 20; day += 1) {
        const row = day + 15;
        const aAmount = day === 1 ? 100 : 0;
        const bAmount = day === 3 ? 100 : 0;
        const sizeIndex = day === 1 ? 0 : day === 3 ? 1 : 0;
        rows.push(`<row r="${row}">${[
            numberCell(`D${row}`, day),
            sharedCell(`G${row}`, sizeIndex),
            sharedCell(`H${row}`, day === 1 ? 2 : 3),
            sharedCell(`I${row}`, day === 1 ? 3 : 2),
            numberCell(`J${row}`, aAmount + bAmount),
            numberCell(`L${row}`, aAmount),
            numberCell(`N${row}`, bAmount),
            numberCell(`P${row}`, day === 1 ? 7 : 0)
        ].join('')}</row>`);
    }
    return `<?xml version="1.0"?><worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function workbookBuffer(monthLabel) {
    const productionShared = ['D1', 'D2', 'A', 'B'];
    return storedZip({
        'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="${monthLabel} 生産予定" sheetId="1" r:id="rId1"/><sheet name="${monthLabel} ロールカリバ替予定" sheetId="2" r:id="rId2"/></sheets></workbook>`,
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
        'xl/sharedStrings.xml': `<?xml version="1.0"?><sst>${productionShared.concat(SHARED).map(value => `<si><t>${value}</t></si>`).join('')}</sst>`,
        'xl/worksheets/sheet1.xml': productionSheetXml(),
        'xl/worksheets/sheet2.xml': maintenanceSheetXml().replace(/t="s"><v>(\d+)<\/v>/g, (_, index) => `t="s"><v>${Number(index) + productionShared.length}</v>`)
    });
}

function workTypes(row) {
    return (Array.isArray(row && row.requiredWorks) ? row.requiredWorks : []).map(work => work.type);
}

test('confirmed 2026.10 layout reads E and H as teams and K as work text', () => {
    const rows = importer.parseMaintenanceWorksheet(maintenanceSheetXml(), SHARED, '2026.10 ロールカリバ替予定');
    const teamsAndWork = rows.find(row => row.date === '2026-10-02');
    assert.deepEqual(workTypes(teamsAndWork), ['caliberChange']);
    const layout = importer.confirmedMaintenanceLayout(2026, 10);
    assert.equal(layout.id, 'roll-caliber-schedule-2026-10');
    assert.deepEqual(layout.team, ['E', 'H']);
    assert.deepEqual(layout.workText, ['K']);
    assert.deepEqual(layout.unknown, ['N']);
    assert.equal(importer.confirmedMaintenanceLayout(2026, 6), null);
    assert.deepEqual(teamsAndWork.teams, [
        { role: 'team', value: 'A' },
        { role: 'team', value: 'B' }
    ]);
    assert.equal(teamsAndWork.workText, 'カリバ替');
    assert.deepEqual(teamsAndWork.scheduledWorks, [{ type: 'caliberChange', role: 'workText' }]);
    assert.deepEqual(workTypes(teamsAndWork), ['caliberChange']);
    assert.equal(JSON.stringify(teamsAndWork.scheduledWorks).includes('A班'), false);
    assert.equal(JSON.stringify(teamsAndWork.requiredWorks).includes('team'), false);
    assert.equal(teamsAndWork.exchangePossibleDate, null);
    const blocked = importer.maintenanceExchangeDecision(teamsAndWork);
    assert.equal(blocked.date, null);
    assert.equal(blocked.state, 'held');
    assert.equal(blocked.exchangePossible, false);
});

test('a team name or a work word in E or H never becomes a work item', () => {
    const rows = importer.parseMaintenanceWorksheet(maintenanceSheetXml(), SHARED, '2026.10 ロールカリバ替予定');
    const shifted = rows.find(row => row.date === '2026-10-03');
    assert.deepEqual(workTypes(shifted), []);
    const teamName = rows.find(row => row.date === '2026-10-02');
    assert.equal(teamName.teams.map(item => item.value).join(','), 'A,B');
    assert.equal(workTypes(teamName).includes('rollChange'), false);
    assert.deepEqual(shifted.teams, [
        { role: 'team', value: null },
        { role: 'team', value: 'A' }
    ]);
    assert.deepEqual(shifted.scheduledWorks, []);
    assert.deepEqual(workTypes(shifted), []);
    assert.equal(shifted.exchangePossibleDate, null);
});

test('K can carry two work words without becoming an exchange day', () => {
    const rows = importer.parseMaintenanceWorksheet(maintenanceSheetXml(), SHARED, '2026.10 ロールカリバ替予定');
    const both = rows.find(row => row.date === '2026-10-04');
    assert.equal(both.workText, 'ロール替／カリバ替');
    assert.deepEqual(both.scheduledWorks.map(work => work.type), ['rollChange', 'caliberChange']);
    assert.equal(both.unknownValuePresent, false);
    const decision = importer.maintenanceExchangeDecision(both);
    assert.equal(decision.date, null);
    assert.equal(decision.state, 'scheduled-only');
    assert.equal(decision.exchangePossible, false);
});

test('N and an unconfirmed month hold instead of creating work or an exchange day', () => {
    const october = importer.parseMaintenanceWorksheet(maintenanceSheetXml(), SHARED, '2026.10 ロールカリバ替予定');
    const unknownColumn = october.find(row => row.date === '2026-10-02');
    assert.equal(workTypes(unknownColumn).includes('rollChange'), false);
    assert.equal(unknownColumn.unknownValuePresent, true);
    assert.equal(unknownColumn.judgement, 'held');
    assert.equal(workTypes(unknownColumn).includes('rollChange'), false);
    assert.deepEqual(importer.maintenanceExchangeDecision(unknownColumn), {
        date: null,
        state: 'held',
        exchangePossible: false
    });

    const june = importer.parseMaintenanceWorksheet(maintenanceSheetXml(), SHARED, '2026.6 ロールカリバ替予定');
    assert.equal(june.length, 1);
    assert.equal(june[0].layoutState, 'unconfirmed');
    assert.equal(june[0].teams, null);
    assert.equal(june[0].workText, null);
    assert.equal(june[0].scheduledWorks, null);
    assert.equal(june[0].requiredWorks, null);
    assert.equal(june[0].judgement, 'held');
    assert.equal(june[0].exchangePossibleDate, null);
    assert.equal(JSON.stringify(june).includes('rollChange'), false);
    assert.equal(JSON.stringify(june).includes('caliberChange'), false);
    assert.deepEqual(importer.maintenanceExchangeDecision(june[0]), {
        date: null,
        state: 'held',
        exchangePossible: false
    });
});

test('an unconfirmed layout stays held on the schedule and a confirmed K work stays scheduled only', async () => {
    const juneBuffer = workbookBuffer('2026.6');
    const juneParsed = await importer.parseXlsxArrayBuffer(juneBuffer.buffer.slice(juneBuffer.byteOffset, juneBuffer.byteOffset + juneBuffer.byteLength));
    assert.equal(juneParsed.schedule.length, 20);
    juneParsed.schedule.forEach(row => {
        assert.equal(row.requiredWorks, null);
        assert.equal(row.maintenanceLayoutState, 'unconfirmed');
        assert.equal(row.maintenanceJudgement, 'held');
        assert.equal(row.exchangePossibleDate, null);
        assert.equal(JSON.stringify(row.requiredWorks), 'null');
    });
    const junePlan = importer.createPlanningResults(juneParsed.schedule, { rules, schedule: scheduleApi });
    assert.equal(junePlan.sizeChanges.length, 1);
    assert.equal(junePlan.sizeChanges[0].recommendation, null);

    const octoberBuffer = workbookBuffer('2026.10');
    const octoberParsed = await importer.parseXlsxArrayBuffer(octoberBuffer.buffer.slice(octoberBuffer.byteOffset, octoberBuffer.byteOffset + octoberBuffer.byteLength));
    const day = octoberParsed.schedule.find(row => row.date === '2026-10-02');
    assert.deepEqual(day.maintenanceTeams, [
        { role: 'team', value: 'A' },
        { role: 'team', value: 'B' }
    ]);
    assert.equal(day.shift1Team, 'B');
    assert.equal(day.maintenanceWorkText, 'カリバ替');
    assert.deepEqual(workTypes(day), ['caliberChange']);
    assert.equal(day.maintenanceJudgement, 'held');
    assert.equal(day.exchangePossibleDate, null);
    const listedOnly = octoberParsed.schedule.find(row => row.date === '2026-10-04');
    assert.equal(listedOnly.maintenanceWorkText, 'ロール替／カリバ替');
    assert.equal(listedOnly.maintenanceJudgement, 'scheduled');
    assert.equal(importer.maintenanceExchangeDecision(listedOnly).state, 'scheduled-only');
    assert.equal(importer.maintenanceExchangeDecision(listedOnly).date, null);
});


test('a missing team amount never becomes a stopped-shift slot', () => {
    const missingValues = [null, undefined, '', ' ', '0', NaN, -1];
    for (const amount of missingValues) {
        const row = {
            date: '2026-10-08',
            shift1Team: 'A',
            shift3Team: 'B',
            productionByTeam: { A: amount, B: 10 },
            requiredWorks: []
        };
        assert.equal(scheduleApi.productionForTeam(row, 'A'), null, String(amount));
        assert.equal(scheduleApi.buildAvailableSlots(row, rules.SLOT_TYPES).length, 0, String(amount));
    }
    const absent = { date: '2026-10-08', shift1Team: 'A', shift3Team: '', productionByTeam: {} };
    assert.equal(scheduleApi.productionForTeam(absent, 'A'), null);
    assert.deepEqual(scheduleApi.buildAvailableSlots(absent, rules.SLOT_TYPES), []);

    const confirmedZero = {
        date: '2026-10-08', shift1Team: 'A', shift3Team: 'B',
        productionByTeam: { A: 0, B: 10 }, requiredWorks: []
    };
    assert.equal(scheduleApi.productionForTeam(confirmedZero, 'A'), 0);
    assert.deepEqual(
        scheduleApi.buildAvailableSlots(confirmedZero, rules.SLOT_TYPES).map(slot => slot.id),
        ['2026-10-08|shift1|A']
    );

    const unconfirmedPlan = { ...confirmedZero, maintenanceLayoutState: 'unconfirmed', requiredWorks: null };
    assert.equal(scheduleApi.countRequiredCompanionWork(unconfirmedPlan), null);
});

test('a night-only stop is not a size-change candidate and a missing amount stays unknown', () => {
    const missingNight = {
        date: '2026-10-02',
        size: 'STOP',
        productionAmount: null,
        shift1Team: '',
        shift3Team: 'B',
        productionByTeam: { B: null },
        requiredWorks: []
    };
    assert.equal(scheduleApi.isNightOnlyRow(missingNight), true);
    assert.equal(scheduleApi.productionForTeam(missingNight, 'B'), null);
    assert.deepEqual(scheduleApi.buildAvailableSlots(missingNight, rules.SLOT_TYPES), []);

    const engine = rules.createPlanningRules({
        preferStoppedShift: true,
        preferSameTeam: true,
        stoppedShiftWeight: 1,
        sameTeamWeight: 2
    });
    const reviewed = scheduleApi.recommendSizeChanges([
        {
            date: '2026-10-01', size: 'D1', productionAmount: 10,
            shift1Team: 'A', shift3Team: '', productionByTeam: { A: 10 },
            requiredWorks: [], maintenanceJudgement: 'scheduled'
        },
        {
            date: '2026-10-02', size: 'STOP', productionAmount: 0,
            shift1Team: '', shift3Team: 'B', productionByTeam: { B: 0 },
            requiredWorks: [], maintenanceJudgement: 'scheduled'
        },
        {
            date: '2026-10-03', size: 'D2', productionAmount: 10,
            shift1Team: 'A', shift3Team: '', productionByTeam: { A: 10 },
            requiredWorks: [], maintenanceJudgement: 'scheduled'
        }
    ], engine, rules.SLOT_TYPES);
    assert.equal(reviewed.length, 1);
    assert.equal(reviewed[0].recommendation, null);
    assert.equal(reviewed[0].candidateSlots.some(slot => slot.shift === 'shift3'), false);
});

test('unknown companion-work count makes a slot ineligible, not merely warned', () => {
    const engine = rules.createPlanningRules({ preferStoppedShift: true });
    const unknownSlot = {
        date: '2026-10-08',
        team: 'A',
        type: rules.SLOT_TYPES.DAY_MAINTENANCE,
        productionActive: false,
        requiredCompanionWorkCount: null
    };
    const decision = engine.scoreSizeChangeSlot(unknownSlot, 'A');
    assert.equal(decision.eligible, false);
    assert.equal(decision.score, Number.NEGATIVE_INFINITY);
    assert.match(decision.warnings.join(','), /作業候補を選びません/);
    assert.equal(engine.chooseSizeChangeSlot([unknownSlot], 'A'), null);
    const knownSlot = { ...unknownSlot, requiredCompanionWorkCount: 0 };
    assert.equal(engine.scoreSizeChangeSlot(knownSlot, 'A').eligible, true);
});
