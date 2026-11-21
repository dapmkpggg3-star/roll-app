// Run on an isolated checkout. The release tree stays read-only: candidate code and
// the verified patch are written to the selected evidence directory only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourcePath = 'js/planning-sheet-output.js';
const evidence = path.resolve(process.argv[2] || path.join(root, 'artifacts/export-check'));
fs.mkdirSync(evidence, { recursive: true });
const work = fs.mkdtempSync(path.join(evidence, 'trial-'));
fs.mkdirSync(path.join(work, 'js'));
fs.mkdirSync(path.join(work, 'test'));
const suite = 'test/planning-sheet-output.test.js';
fs.copyFileSync(path.join(root, suite), path.join(work, suite));
const candidatePath = path.join(work, sourcePath);
const original = fs.readFileSync(path.join(root, sourcePath), 'utf8');
let source = original;
const rows = [];
const controls = { date: '2031-10-02', size: 'D13', shift1Team: 'A', shift3Team: '', productionAmount: 100 };
const fields = [
  ['date', 'dateParts', 'null'],
  ['size', 'displaySize', "''"],
  ['shift1Team', 'normalizeTeam', "''"],
  ['shift3Team', 'normalizeTeam', "''"]
];

function loadCandidate() {
  fs.writeFileSync(candidatePath, source);
  delete require.cache[require.resolve(candidatePath)];
  return require(candidatePath);
}

function testField(api, field) {
  const row = { ...controls };
  if (field === 'shift3Team') Object.assign(row, { shift1Team: '', shift3Team: 'B' });
  const build = value => api.buildExportPayload({ schedule: [{ ...row, [field]: value }] },
    { period: { year: 2031, month: 10 }, now: 1, random: 0 });
  assert.equal(build(row[field]).calendarRows.length, 1);
  for (const bad of [[row[field]], [[row[field]]], true, null, {}]) {
    try { build(bad); } catch (error) {
      if (!/日付|生産予定|サイズ|班/.test(error.message)) throw error;
      continue;
    }
    return { accepted: bad };
  }
  return null;
}

function regress() {
  const result = spawnSync(process.execPath, ['--test', suite], { cwd: work, encoding: 'utf8', timeout: 30000 });
  if (result.error || result.status !== 0) throw Error(result.error?.message || result.stdout || result.stderr);
}

const patchFile = path.join(evidence, 'candidate.patch');
fs.rmSync(patchFile, { force: true });
try {
  for (const [field, parser, rejection] of fields) {
    const failure = testField(loadCandidate(), field);
    if (!failure) { rows.push({ field, status: 'pass' }); continue; }
    // The only automatic edit permitted is a string-type guard on a named parser.
    const signature = 'function ' + parser + '(value) {';
    const guard = "if (typeof value !== 'string') return " + rejection + ';';
    const before = source;
    const body = source.split(signature);
    if (body.length !== 2 || body[1].trimStart().startsWith(guard)) {
      rows.push({ field, status: 'needs-review', failure });
      continue;
    }
    source = source.replace(signature, signature + '\n        ' + guard);
    try {
      assert.equal(testField(loadCandidate(), field), null);
      regress();
      rows.push({ field, status: 'repaired-in-copy', failure });
    } catch (error) {
      source = before;
      rows.push({ field, status: 'needs-review', failure, reason: error.message });
    }
  }
  const api = loadCandidate();
  regress();
  for (const [field] of fields) {
    if (testField(api, field) && !rows.some(r => r.field === field && r.status === 'needs-review')) {
      throw Error('A later change broke ' + field);
    }
  }
  if (source !== original) {
    const git = spawnSync('git', ['diff', '--no-index', '--no-color', '--', path.join(root, sourcePath), candidatePath],
      { encoding: 'utf8' });
    if (git.status !== 1) throw Error('Could not generate candidate patch');
    const hunk = git.stdout.indexOf('\n@@ ');
    if (hunk < 0) throw Error('Missing patch hunk');
    fs.writeFileSync(patchFile, '--- a/' + sourcePath + '\n+++ b/' + sourcePath + git.stdout.slice(hunk));
  }
  console.log(JSON.stringify(rows));
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(rows, null, 2));
  // A verified patch still needs applying on the isolated branch. Keep CI open until it is.
  if (rows.some(r => r.status !== 'pass')) process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
