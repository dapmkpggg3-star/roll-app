const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const outbound = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
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
    console.log('ROLL-003 offline recovery browser PASS');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
