const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const exportedNames = ['#16-FILE-A', '#16-FILE-B'];
const otherName = '#16-OTHER';

function canonicalRecoveryJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalRecoveryJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalRecoveryJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function recoveryChecksum(payload) {
  const text = canonicalRecoveryJson(payload);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function installLocalRoute(context, outbound) {
  await context.route('**/*', async route => {
    let url;
    try { url = new URL(route.request().url()); } catch (error) { return route.abort('blockedbyclient'); }
    if (url.protocol !== 'http:' || url.hostname !== 'roll-app.test') {
      outbound.push(url.href);
      return route.abort('blockedbyclient');
    }
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const absolute = path.resolve(root, `.${rel}`);
    if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) return route.abort('blockedbyclient');
    return route.fulfill({ path: absolute, contentType: mime[path.extname(absolute)] || 'application/octet-stream' });
  });
}

async function openAnonymousPage(browser, outbound) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', acceptDownloads: true });
  await installLocalRoute(context, outbound);
  const page = await context.newPage();
  await page.goto('http://roll-app.test/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
  });
  return { context, page };
}

function armDialogs(page, decisions) {
  const messages = [];
  const pending = decisions.slice();
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const handler = async dialog => {
    messages.push(dialog.message());
    const decision = pending.shift();
    if (decision === 'accept') await dialog.accept();
    else await dialog.dismiss();
    if (pending.length === 0) {
      page.off('dialog', handler);
      resolveDone(messages);
    }
  };
  page.on('dialog', handler);
  return done;
}

async function roleNames(page) {
  return page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('roles') || '[]').map(role => role.name);
    return { memory: roles.map(role => role.name), stored };
  });
}

async function requireRollbackDownload(download, savedName) {
  assert.ok(download, '取り消し用JSONのダウンロードがありません');
  assert.equal(download.suggestedFilename(), 'roll-offline-recovery-rollback.json');
  const dir = path.join(root, 'artifacts/roll003-file-recovery');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, savedName);
  await download.saveAs(filePath);
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const { checksum, ...payload } = pkg;
  assert.equal(pkg.kind, 'roll-app-offline-recovery');
  assert.equal(pkg.version, 1);
  assert.equal(checksum, recoveryChecksum(payload));
  assert.deepEqual(pkg.roles.map(role => role.name), [otherName]);
  assert.equal(pkg.roles[0].memo, 'anon-other');
  assert.equal(pkg.roles.some(role => exportedNames.includes(role.name)), false);
  return {
    fileName: download.suggestedFilename(),
    checksum,
    names: pkg.roles.map(role => role.name),
    bytes: fs.statSync(filePath).size
  };
}

async function exportRecoveryFile(browser, outbound) {
  const { context, page } = await openAnonymousPage(browser, outbound);
  try {
    await page.evaluate(names => {
      roles = names.map((name, index) => ({
        id: `file-${index + 1}`,
        name,
        status: 'オンライン',
        memo: `anon-file-${index + 1}`,
        updatedAt: '2026-11-18T00:00:00.000Z',
        history: []
      }));
      localStorage.setItem('roles', JSON.stringify(roles));
      renderRoles();
    }, exportedNames);
    await page.locator('#toggleRoleFormBtn').click();
    const button = page.locator('#exportOfflineRecoveryBtn');
    await button.waitFor({ state: 'visible' });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      button.click()
    ]);
    assert.equal(download.suggestedFilename(), 'roll-offline-recovery.json');
    const dir = path.join(root, 'artifacts/roll003-file-recovery');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'roll-offline-recovery.json');
    await download.saveAs(filePath);
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const { checksum, ...payload } = pkg;
    assert.equal(pkg.kind, 'roll-app-offline-recovery');
    assert.equal(pkg.version, 1);
    assert.equal(pkg.roles.length, exportedNames.length);
    assert.deepEqual(pkg.roles.map(role => role.name), exportedNames);
    assert.equal(checksum, recoveryChecksum(payload));
    const verified = await page.evaluate(file => verifyOfflineRecoveryPackage(file), pkg);
    assert.equal(verified.ok, true);
    assert.equal(verified.roleCount, exportedNames.length);
    return { filePath, roleCount: pkg.roles.length, names: pkg.roles.map(role => role.name), checksum, bytes: fs.statSync(filePath).size };
  } finally {
    await context.close();
  }
}

async function restoreRecoveryFileInNewBrowser(browser, filePath, outbound) {
  const { context, page } = await openAnonymousPage(browser, outbound);
  try {
    await page.evaluate(name => {
      roles = [{ id: 'other-1', name, status: 'オンライン', memo: 'anon-other', updatedAt: '2026-11-18T00:00:00.000Z', history: [] }];
      localStorage.setItem('roles', JSON.stringify(roles));
      renderRoles();
    }, otherName);
    await page.locator('#toggleRoleFormBtn').click();
    const input = page.locator('#offline-recovery-input');

    const refused = armDialogs(page, ['dismiss']);
    await input.setInputFiles(filePath);
    const refusedMessages = await refused;
    assert.match(refusedMessages[0], /復旧ファイルは2件です/);
    const afterRefuse = await roleNames(page);
    assert.deepEqual(afterRefuse.memory, [otherName]);
    assert.deepEqual(afterRefuse.stored, [otherName]);
    assert.equal(await page.locator('#role-file-1').count(), 0);

    const secondRefuse = armDialogs(page, ['accept', 'dismiss']);
    const refusedRollbackPromise = page.waitForEvent('download', { timeout: 10000 });
    await input.setInputFiles(filePath);
    const secondMessages = await secondRefuse;
    assert.match(secondMessages[0], /復旧ファイルは2件です/);
    assert.match(secondMessages[1], /取り消し用ファイルの保存を開始しました/);
    const refusedRollback = await requireRollbackDownload(await refusedRollbackPromise, 'rollback-on-refuse.json');
    const afterSecondRefuse = await roleNames(page);
    assert.deepEqual(afterSecondRefuse.memory, [otherName]);
    assert.deepEqual(afterSecondRefuse.stored, [otherName]);

    const applied = armDialogs(page, ['accept', 'accept', 'accept']);
    const beforeApplyPromise = page.waitForEvent('download', { timeout: 10000 });
    await input.setInputFiles(filePath);
    const appliedMessages = await applied;
    const beforeApply = await requireRollbackDownload(await beforeApplyPromise, 'roll-offline-recovery-rollback.json');
    assert.match(appliedMessages[2], /復旧ファイルを適用しました/);
    await page.locator('#role-file-1').waitFor();
    const afterApply = await roleNames(page);
    assert.deepEqual(afterApply.memory, exportedNames);
    assert.deepEqual(afterApply.stored, exportedNames);
    assert.equal(await page.locator('#role-other-1').count(), 0);

    const undone = armDialogs(page, ['accept', 'accept']);
    await page.locator('#undoOfflineRecoveryBtn').click();
    const undoneMessages = await undone;
    assert.match(undoneMessages[0], /適用前のデータへ戻しますか/);
    assert.match(undoneMessages[1], /適用前のデータへ戻しました/);
    await page.locator('#role-other-1').waitFor();
    const afterUndo = await roleNames(page);
    assert.deepEqual(afterUndo.memory, [otherName]);
    assert.deepEqual(afterUndo.stored, [otherName]);
    assert.equal(await page.locator('#role-file-1').count(), 0);
    return {
      refusedName: afterRefuse.memory[0],
      restoredNames: afterApply.memory,
      undoneName: afterUndo.memory[0],
      refusedRollback,
      beforeApply
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const outbound = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await installLocalRoute(context, outbound);
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(String(error.message)));
    await page.goto('http://roll-app.test/index.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'block';
      roles = [{ id: 'anon-1', name: '#99-ANON', status: 'オンライン', memo: 'local-anon', updatedAt: '2026-11-13T00:00:00.000Z', history: [] }];
      localStorage.setItem('roles', JSON.stringify(roles));
    });
    const pkg = await page.evaluate(() => buildOfflineRecoveryPackage({
      roles,
      localOriginal: [{ id: 'anon-1', memo: 'local-anon' }],
      remoteOriginal: [{ id: 'anon-1', memo: 'remote-anon' }],
      savedAt: '2026-11-13T00:00:00.000Z'
    }));
    await page.evaluate(() => {
      localStorage.clear();
      roles = [];
      renderRoles();
    });
    assert.equal(await page.locator('#role-anon-1').count(), 0);
    const refused = await page.evaluate(file => applyOfflineRecoveryPackage(localStorage, file, { confirmed: false, rollbackAcknowledged: false }), pkg);
    assert.equal(refused.applied, false);
    assert.equal(await page.locator('#role-anon-1').count(), 0);
    const applied = await page.evaluate(file => {
      const result = applyOfflineRecoveryPackage(localStorage, file, { confirmed: true, rollbackAcknowledged: true });
      if (!result.applied) return result;
      roles = result.roles;
      searchQuery = '';
      statusFilter = 'all';
      memoOnlyFilter = false;
      watchStandFilter = null;
      renderRoles();
      return { applied: true };
    }, pkg);
    assert.equal(applied.applied, true);
    assert.equal(await page.locator('#role-anon-1').count(), 1);
    const undone = await page.evaluate(() => {
      const result = rollbackOfflineRecovery(localStorage, { confirmed: true });
      if (!result.applied) return result;
      roles = result.roles;
      renderRoles();
      return { applied: true, count: roles.length };
    });
    assert.equal(undone.applied, true);
    assert.equal(undone.count, 0);
    assert.equal(await page.locator('#exportOfflineRecoveryBtn').count(), 1);
    assert.equal(failures.length, 0, failures.join('\n'));
    assert.equal(outbound.length, 0, outbound.join('\n'));

    const saved = await exportRecoveryFile(browser, outbound);
    const restored = await restoreRecoveryFileInNewBrowser(browser, saved.filePath, outbound);
    fs.writeFileSync(path.join(root, 'artifacts/roll003-file-recovery/evidence.json'), JSON.stringify({
      status: 'PASS',
      fileName: 'roll-offline-recovery.json',
      roleCount: saved.roleCount,
      names: saved.names,
      checksum: saved.checksum,
      checksumMatchesCanonicalPayload: true,
      refusedLeftOtherRole: restored.refusedName,
      rollbackFileName: restored.beforeApply.fileName,
      rollbackChecksum: restored.beforeApply.checksum,
      rollbackNames: restored.beforeApply.names,
      rollbackBytes: restored.beforeApply.bytes,
      refusedRollbackChecksum: restored.refusedRollback.checksum,
      restoredNames: restored.restoredNames,
      undoneName: restored.undoneName,
      remoteRequestsBlocked: outbound.length
    }, null, 2));
    console.log('ROLL-003 offline recovery browser PASS');
    console.log('ROLL-003 file round trip:', saved.roleCount, saved.checksum);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
