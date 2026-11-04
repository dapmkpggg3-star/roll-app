// Deterministic, offline bundle. Never uploads, configures or enables GAS.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['google-apps-script.gs', ...[
    'online-safety', 'workshop-instructions', 'workshop-adoption', 'workshop-plan-link',
    'workshop-status-bridge', 'workshop-recovery'
].map(name => 'js/' + name + '.js'), ...[
    'workshop-operation-store', 'workshop-mutation-guard', 'workshop-plan-store',
    'workshop-instruction-store', 'workshop-roles-port', 'workshop-history-port',
    'workshop-write-guard', 'workshop-api'
].map(name => 'gas/' + name + '.gs')];
function build() {
    const source = files.map(file => '// Source: ' + file + '\n' + fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n');
    new vm.Script(source);
    return source;
}
module.exports = { build, files };
if (require.main === module) {
    if (!process.argv[2]) throw new Error('Specify the output .gs file path. This command does not deploy.');
    const output = path.resolve(process.argv[2]);
    if (files.some(file => path.join(root, file) === output)) throw new Error('Output must not overwrite an input.');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, build());
    console.log('Built validation bundle: ' + output);
}
