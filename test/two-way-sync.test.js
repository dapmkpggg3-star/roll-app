const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STATUSES = [
    'オンライン',
    '中古予備（バラシ前）',
    '改削行き（搬出可能）',
    '改削中',
    '新品予備（組替可能）',
    '新品予備（組込完了）',
    '新品予備保管',
    '発注済み（納入待ち）',
    '廃却待ち（ラック保管）',
    '廃棄'
];

function createStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
}

function loadSyncFunctions() {
    const context = vm.createContext({
        console,
        window: {},
        document: {
            addEventListener() {},
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; }
        },
        localStorage: createStorage(),
        ALLOWED_STATUSES: STATUSES,
        normalizeRoleStatusValue: value => STATUSES.includes(String(value || '').trim())
            ? String(value || '').trim()
            : '中古予備（バラシ前）',
        normalizeCoatingStatusValue: value => String(value || ''),
        normalizeCurrentDiameter: value => value == null ? '' : value,
        normalizeDateInputValue: value => String(value || '')
    });
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8');
    vm.runInContext(source, context);
    return context;
}

function loadGasFunctions() {
    const context = vm.createContext({ console });
    const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8');
    vm.runInContext(source, context);
    return context;
}

function role(id, name, status, updatedAt, extra = {}) {
    return { id, name, status, updatedAt, history: [], isActiveThreeSet: true, nextAssemblyPlanned: false, ...extra };
}

test('newer spreadsheet role wins while both histories are retained', () => {
    const sync = loadSyncFunctions();
    const remote = role(1, '#16-85', '改削中', '2026-09-20T02:00:00.000Z', {
        history: [{ at: '2026-09-20T02:00:00.000Z', roleName: '#16-85', type: 'status', before: '改削行き（搬出可能）', after: '改削中' }]
    });
    const local = role(1, '#16-85', '改削行き（搬出可能）', '2026-09-20T01:00:00.000Z', {
        history: [{ at: '2026-09-20T01:00:00.000Z', roleName: '#16-85', type: 'memo', before: '-', after: '依頼済み' }]
    });

    const merged = sync.mergeRemoteAndLocalRoles([remote], [local]);
    assert.equal(merged[0].status, '改削中');
    assert.equal(merged[0].updatedAt, remote.updatedAt);
    assert.equal(merged[0].history.length, 2);
});

test('newer app role wins and equal timestamps keep the app value', () => {
    const sync = loadSyncFunctions();
    const remote = role(1, '#16-85', '改削中', '2026-09-20T01:00:00.000Z');
    const local = role(1, '#16-85', '新品予備（組替可能）', '2026-09-20T02:00:00.000Z');
    assert.equal(sync.mergeRemoteAndLocalRoles([remote], [local])[0].status, '新品予備（組替可能）');

    const equalRemote = role(1, '#16-85', '改削中', local.updatedAt);
    assert.equal(sync.mergeRemoteAndLocalRoles([equalRemote], [local])[0].status, '新品予備（組替可能）');
});

test('older app schema inherits newer fields without replacing its newer status', () => {
    const sync = loadSyncFunctions();
    const remote = role(1, '#16-85', '改削中', '2026-09-20T01:00:00.000Z', {
        isActiveThreeSet: true,
        nextAssemblyPlanned: true
    });
    const local = {
        id: 1,
        name: '#16-85',
        status: '新品予備（組込完了）',
        updatedAt: '2026-09-20T02:00:00.000Z',
        history: []
    };

    const merged = sync.mergeRemoteAndLocalRoles([remote], [local])[0];
    assert.equal(merged.status, '新品予備（組込完了）');
    assert.equal(merged.isActiveThreeSet, true);
    assert.equal(merged.nextAssemblyPlanned, true);
});

test('history sheet block detection finds both stands and their roll IDs', () => {
    const gas = loadGasFunctions();
    const rows = [
        new Array(38).fill(''),
        ['#16st', ...new Array(17).fill(''), '#17st'],
        new Array(38).fill(''),
        new Array(38).fill(''),
        ['16-上-85', ...new Array(17).fill(''), '17-上-86']
    ];

    const definitions = gas.buildRollHistoryStatusDefinitionsFromValues(rows, 38);
    assert.deepEqual(
        JSON.parse(JSON.stringify(definitions.map(item => ({ roleName: item.roleName, bannerRow: item.bannerRow, startColumn: item.startColumn, endColumn: item.endColumn })))),
        [
            { roleName: '#16-85', bannerRow: 1, startColumn: 1, endColumn: 18 },
            { roleName: '#17-86', bannerRow: 1, startColumn: 19, endColumn: 38 }
        ]
    );
});

test('history status formula and dropdown text use the shared Roles status', () => {
    const gas = loadGasFunctions();
    assert.equal(
        gas.buildRollHistoryStatusFormula('#16-85'),
        '=IFERROR(LET(st,XLOOKUP("#16-85",Roles!$B:$B,Roles!$C:$C,""),IF(st="","","#16-85　ステータス："&st)),"")'
    );
    assert.equal(gas.parseRollHistoryStatusDisplay('#16-85　ステータス：改削中', '#16-85'), '改削中');
    assert.equal(gas.parseRollHistoryStatusDisplay('不正な状態', '#16-85'), '');
});

test('16,17 history band adds actual dispatch, arrival, diameter and use dates', () => {
    const gas = loadGasFunctions();
    const formula = gas.buildRollHistoryActualFormula('#16-85');

    assert.match(formula, /Roles!\$G:\$G/);
    assert.match(formula, /dispatchDate/);
    assert.match(formula, /arrivalDate/);
    assert.match(formula, /Roles!\$I:\$I/);
    assert.match(formula, /Roles!\$J:\$J/);
    assert.match(formula, /Roles!\$N:\$N/);
    assert.match(formula, /搬出：/);
    assert.match(formula, /搬入：/);
    assert.match(formula, /径：/);
    assert.match(formula, /開始：/);
    assert.match(formula, /終了：/);
});

test('spreadsheet status change updates timestamp and history', () => {
    const gas = loadGasFunctions();
    const changedAt = '2026-09-20T03:00:00.000Z';
    const result = gas.applyRollHistoryStatusChangeToRoles([
        role(1, '#16-85', '改削行き（搬出可能）', '2026-09-20T01:00:00.000Z')
    ], '#16-85', '改削中', changedAt, '2026-09-20');

    assert.equal(result.changed, true);
    assert.equal(result.roles[0].status, '改削中');
    assert.equal(result.roles[0].updatedAt, changedAt);
    assert.equal(result.roles[0].history.at(-1).operator.name, 'スプレッドシート');
});

test('spreadsheet online assignment atomically rotates the old online roll', () => {
    const gas = loadGasFunctions();
    const changedAt = '2026-09-20T03:00:00.000Z';
    const result = gas.applyRollHistoryStatusChangeToRoles([
        role(1, '#16-86', 'オンライン', '2026-09-20T01:00:00.000Z', { useStartDate: '2026-07-14', useEndDate: '' }),
        role(2, '#16-87', '新品予備（組込完了）', '2026-09-20T01:00:00.000Z', { nextAssemblyPlanned: true })
    ], '#16-87', 'オンライン', changedAt, '2026-09-20');

    const oldOnline = result.roles.find(item => item.name === '#16-86');
    const newOnline = result.roles.find(item => item.name === '#16-87');
    assert.equal(oldOnline.status, '中古予備（バラシ前）');
    assert.equal(oldOnline.useEndDate, '2026-09-20');
    assert.equal(newOnline.status, 'オンライン');
    assert.equal(newOnline.useStartDate, '2026-09-20');
    assert.equal(newOnline.useEndDate, '');
    assert.equal(newOnline.nextAssemblyPlanned, false);
    assert.deepEqual(JSON.parse(JSON.stringify(result.updatedRoleNames)), ['#16-86', '#16-87']);
});

test('spreadsheet cannot remove the last online roll', () => {
    const gas = loadGasFunctions();
    assert.throws(() => gas.applyRollHistoryStatusChangeToRoles([
        role(1, '#16-86', 'オンライン', '2026-09-20T01:00:00.000Z'),
        role(2, '#16-87', '新品予備（組込完了）', '2026-09-20T01:00:00.000Z')
    ], '#16-86', '中古予備（バラシ前）', '2026-09-20T03:00:00.000Z', '2026-09-20'), /オンラインが0本/);
});
