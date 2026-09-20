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

test('migration accepts either a raw spreadsheet id or a Google Sheets URL', () => {
    const gas = loadGasFunctions();
    const spreadsheetId = 'sampleSpreadsheetId-123';
    assert.equal(gas.normalizeSpreadsheetIdForRollHistory(spreadsheetId), spreadsheetId);
    assert.equal(
        gas.normalizeSpreadsheetIdForRollHistory(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`),
        spreadsheetId
    );
});

test('legacy simplified sheet generator is blocked to protect imported history', () => {
    const gas = loadGasFunctions();
    assert.throws(
        () => gas.initializePairedRollManagementViews(),
        /簡易生成処理は廃止/
    );
});

test('migration sheet list covers every paired stand sheet', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.gs'), 'utf8');
    const expectedNames = ['2,3', '4,5', '6,7', '8,9', '10,11', '12,13', '14,15', '16,17'];
    expectedNames.forEach(name => assert.match(source, new RegExp(`'${name.replace(',', '\\,')}'`)));
});
