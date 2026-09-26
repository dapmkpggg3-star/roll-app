const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GAS_PATH = path.join(__dirname, '..', 'google-apps-script.gs');

function loadGasFunctions(propertyValue) {
    const openedIds = [];
    const context = vm.createContext({
        console,
        PropertiesService: {
            getScriptProperties() {
                return {
                    getProperty(key) {
                        assert.equal(key, 'ROLL_MANAGEMENT_SPREADSHEET_ID');
                        return propertyValue;
                    }
                };
            }
        },
        SpreadsheetApp: {
            openById(id) {
                openedIds.push(id);
                return { id };
            }
        }
    });
    vm.runInContext(fs.readFileSync(GAS_PATH, 'utf8'), context);
    return { gas: context, openedIds };
}

test('managed spreadsheet id is read from Script Properties', () => {
    const spreadsheetId = 'sample-managed-spreadsheet-id-123';
    const { gas, openedIds } = loadGasFunctions(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`
    );

    const spreadsheet = gas.openRollManagementSpreadsheet_();

    assert.equal(spreadsheet.id, spreadsheetId);
    assert.deepEqual(openedIds, [spreadsheetId]);
});

test('missing managed spreadsheet id fails with a setup instruction', () => {
    const { gas, openedIds } = loadGasFunctions('');

    assert.throws(
        () => gas.openRollManagementSpreadsheet_(),
        /ROLL_MANAGEMENT_SPREADSHEET_ID/
    );
    assert.deepEqual(openedIds, []);
});

test('repository source does not hardcode a spreadsheet id', () => {
    const source = fs.readFileSync(GAS_PATH, 'utf8');
    assert.doesNotMatch(
        source,
        /SpreadsheetApp\.openById\(\s*['"][A-Za-z0-9_-]{20,}['"]\s*\)/
    );
});
