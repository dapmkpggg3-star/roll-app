const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGasFunctions() {
    const context = vm.createContext({ console });
    const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8');
    vm.runInContext(source, context);
    return context;
}

function field(value, { planned = false, blank = false } = {}) {
    return { value, planned, isBlank: blank };
}

function cycle(rowNumber, values) {
    return {
        rowNumber,
        fields: {
            dispatchDate: field('', { blank: true }),
            arrivalDate: field('', { blank: true }),
            currentDiameter: field('', { blank: true }),
            useStartDate: field('', { blank: true }),
            useEndDate: field('', { blank: true }),
            ...values
        }
    };
}

test('actual dispatch replaces the planned dispatch in the next cycle row', () => {
    const gas = loadGasFunctions();
    const rows = [
        cycle(438, {
            dispatchDate: field('2025-10-03'),
            arrivalDate: field('2025-12-22'),
            currentDiameter: field(338),
            useStartDate: field('2026-04-18'),
            useEndDate: field('2026-07-07')
        }),
        cycle(439, {
            dispatchDate: field('', { planned: true }),
            arrivalDate: field('', { planned: true }),
            useStartDate: field('', { planned: true }),
            useEndDate: field('', { planned: true })
        })
    ];
    const plan = gas.planRollHistoryActualWrites(rows, {
        dispatchDate: '2026-08-21',
        arrivalDate: '',
        currentDiameter: 338,
        useStartDate: '2026-06-08',
        useEndDate: '2026-07-07'
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(plan.writes)),
        [{ field: 'dispatchDate', rowNumber: 439, value: '2026-08-21' }]
    );
    assert.equal(plan.conflicts.length, 1);
    assert.equal(plan.conflicts[0].field, 'useStartDate');
    assert.equal(plan.conflicts[0].reason, 'paired-row-has-different-actual');
});

test('a different actual on the paired cycle row is never overwritten', () => {
    const gas = loadGasFunctions();
    const rows = [cycle(324, {
        dispatchDate: field('2025-09-26'),
        arrivalDate: field('2025-11-21'),
        currentDiameter: field(324.41),
        useStartDate: field('2026-04-10'),
        useEndDate: field('2026-07-12')
    })];
    const plan = gas.planRollHistoryActualWrites(rows, {
        dispatchDate: '',
        arrivalDate: '',
        currentDiameter: 324.4,
        useStartDate: '2026-06-08',
        useEndDate: '2026-07-12'
    });

    assert.equal(plan.writes.length, 0);
    assert.equal(plan.conflicts.length, 1);
    assert.equal(plan.conflicts[0].rowNumber, 324);
    assert.equal(plan.conflicts[0].existing, '2026-04-10');
});

test('planned matching values are rewritten so they become black actuals', () => {
    const gas = loadGasFunctions();
    const rows = [cycle(351, {
        dispatchDate: field('2026-02-05'),
        arrivalDate: field('2026-03-27'),
        currentDiameter: field(327.62),
        useStartDate: field('2026-07-14'),
        useEndDate: field('2026-10-01', { planned: true })
    })];
    const plan = gas.planRollHistoryActualWrites(rows, {
        dispatchDate: '2026-02-05',
        arrivalDate: '2026-03-27',
        currentDiameter: 327.6,
        useStartDate: '2026-07-14',
        useEndDate: '2026-10-01'
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(plan.writes)),
        [{ field: 'useEndDate', rowNumber: 351, value: '2026-10-01' }]
    );
});

test('cycle rows distinguish blue or red plans from black actuals', () => {
    const gas = loadGasFunctions();
    const values = [[
        '', '', '2026', '8', '21', '', '', '', '', '', '338', '2027', '1', '', '', '', ''
    ]];
    const colors = [[
        '#000000', '#000000', '#0000ff', '#0000ff', '#0000ff', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#ff0000', '#ff0000', '#ff0000', '#000000', '#000000', '#000000'
    ]];
    const rows = gas.buildRollHistoryCycleRows(439, values, colors);

    assert.equal(rows[0].fields.dispatchDate.value, '2026-08-21');
    assert.equal(rows[0].fields.dispatchDate.planned, true);
    assert.equal(rows[0].fields.currentDiameter.planned, false);
    assert.equal(rows[0].fields.useStartDate.value, '');
    assert.equal(rows[0].fields.useStartDate.planned, true);
});
