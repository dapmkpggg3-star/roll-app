const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const fakeUrl = 'https://roll-app.test/fake-gas';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const localRole = { id: '1', name: '#99-1', status: 'オンライン', memo: 'local-kept', updatedAt: '2026-11-12T00:00:00.000Z', history: [] };
const remoteRole = { id: '1', name: '#99-1', status: 'オンライン', memo: 'remote-kept', updatedAt: '2026-11-01T00:00:00.000Z', history: [] };
const successText = 'スプレッドシートへの反映を確認しました。';

const scenarios = [
  {
    id: 'revision-conflict',
    label: 'Remote revision競合',
    message: /上書きせず停止/,
    timeout: 8000
  },
  {
    id: 'partial',
    label: '一部未反映',
    message: /一部未反映/,
    timeout: 8000
  },
  {
    id: 'unknown',
    label: '保存結果が未確定',
    message: /保存結果が未確定です/,
    timeout: 8000
  },
  {
    id: 'timeout',
    label: '保存結果の時間超過',
    message: /時間内に終わりませんでした/,
    timeout: 20000
  },
  {
    id: 'status-fail',
    label: '状態照会失敗',
    message: /HTTP 500/,
    timeout: 8000
  },
  {
    id: 'send-fail',
    label: '送信失敗',
    message: /送信できませんでした。保存できたかは未確定です/,
    timeout: 8000
  }
];

function configScript() {
  return `globalThis.ROLL_APP_CONFIG = Object.freeze({ apiEndpoint: ${JSON.stringify(fakeUrl)}, firebase: { apiKey: '', authDomain: '', projectId: '', appId: '' } });\n`;
}

function requestAction(request) {
  const url = new URL(request.url());
  if (request.method() === 'POST') {
    const body = JSON.parse(request.postData() || '{}');
    return { url, action: body.action || url.searchParams.get('action') || '', body };
  }
  return { url, action: url.searchParams.get('action') || '', body: null };
}

function fakeResponse(scenario, request) {
  const { url, action, body } = requestAction(request);
  assert.equal(url.origin + url.pathname, fakeUrl);
  const requestId = (body && body.requestId) || url.searchParams.get('requestId') || '';
  if (action === 'fetch') {
    return { status: 200, body: { success: true, revision: 'rev-remote', roles: [remoteRole] } };
  }
  if (action === 'save') {
    assert.equal(body.expectedRevision, 'rev-remote');
    if (scenario === 'send-fail') return { abort: true };
    return { status: 200, body: { success: true, accepted: true } };
  }
  if (action === 'fetchSaveStatus') {
    if (scenario === 'status-fail') return { status: 500, body: { success: false, error: 'status down' } };
    if (scenario === 'timeout') return { status: 200, body: { success: true, pending: true } };
    if (scenario === 'unknown') return { status: 200, body: { success: true, status: { requestId, state: 'accepted' } } };
    if (scenario === 'partial') {
      return { status: 200, body: { success: true, status: { requestId, state: 'partial', rolesSaved: true, error: '管理データは保存済みですが履歴表が未反映です。' } } };
    }
    return { status: 200, body: { success: true, status: { requestId, state: 'error', error: '取得後にスプレッドシートが更新されたため上書きせず停止しました。' } } };
  }
  throw new Error('unexpected fixture action ' + action);
}

async function main() {
  assert.match(fs.readFileSync(path.join(root, 'js/deployment-config.js'), 'utf8'), /apiEndpoint:\s*''/);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const outbound = [];
  const evidence = [];
  const dir = path.join(root, 'artifacts/roll002-sync-stop');
  fs.mkdirSync(dir, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    let scenario = 'revision-conflict';
    const calls = [];
    await context.route('**/*', async route => {
      let url;
      try { url = new URL(route.request().url()); } catch (error) { return route.abort('blockedbyclient'); }
      if (url.hostname !== 'roll-app.test') {
        outbound.push(url.href);
        return route.abort('blockedbyclient');
      }
      if (url.pathname === '/fake-gas') {
        const decision = fakeResponse(scenario, route.request());
        const parsed = requestAction(route.request());
        calls.push({ scenario, action: parsed.action, method: route.request().method() });
        if (decision.abort) return route.abort('failed');
        return route.fulfill({
          status: decision.status,
          contentType: 'application/json; charset=utf-8',
          headers: { 'access-control-allow-origin': 'http://roll-app.test' },
          body: JSON.stringify(decision.body)
        });
      }
      if (url.protocol !== 'http:') {
        outbound.push(url.href);
        return route.abort('blockedbyclient');
      }
      if (url.pathname === '/js/deployment-config.js') {
        return route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: configScript() });
      }
      const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const absolute = path.resolve(root, `.${rel}`);
      if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) return route.abort('blockedbyclient');
      return route.fulfill({ path: absolute, contentType: mime[path.extname(absolute)] || 'application/octet-stream' });
    });

    for (const item of scenarios) {
      scenario = item.id;
      calls.length = 0;
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error.message)));
      page.on('dialog', dialog => { pageErrors.push('dialog:' + dialog.message()); return dialog.dismiss(); });
      await page.goto('http://roll-app.test/index.html', { waitUntil: 'load' });
      await page.evaluate(fixture => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-screen').style.display = 'block';
        window.rollApiFetch = (input, options = {}) => {
          const target = new URL(input, location.href);
          if (target.origin + target.pathname !== fixture) throw new Error('blocked non-fixture url ' + target.href);
          return fetch(input, options);
        };
        roles = [{ id: '1', name: '#99-1', status: 'オンライン', memo: 'local-kept', updatedAt: '2026-11-12T00:00:00.000Z', history: [] }];
        localStorage.setItem('roles', JSON.stringify(roles));
        localStorage.setItem('roles_backup_before_sync', JSON.stringify([{ id: '1', memo: 'previous-success' }]));
        renderRoles();
      }, fakeUrl);
      const configured = await page.evaluate(fixture => ({ on: isRemoteConfigured(), endpoint: globalThis.ROLL_APP_CONFIG.apiEndpoint }), fakeUrl);
      assert.equal(configured.on, true);
      assert.equal(configured.endpoint, fakeUrl);
      await page.locator('#toggleRoleFormBtn').click();
      const button = page.locator('#syncSheetsBtn');
      await button.waitFor({ state: 'visible' });
      await button.click();
      await page.waitForFunction(pattern => {
        const message = document.getElementById('sync-message').textContent || '';
        const label = document.getElementById('syncSheetsBtn').textContent || '';
        return new RegExp(pattern).test(message) && label === 'スプレッドシートと同期';
      }, item.message.source, { timeout: item.timeout });
      await page.waitForTimeout(400);
      const screen = await page.evaluate(() => {
        const message = document.getElementById('sync-message');
        const originals = readIndependentSyncOriginals();
        return {
          message: message.textContent,
          color: message.style.color,
          button: document.getElementById('syncSheetsBtn').textContent,
          disabled: document.getElementById('syncSheetsBtn').disabled,
          memory: roles.map(role => role.memo),
          stored: JSON.parse(localStorage.getItem('roles') || '[]').map(role => role.memo),
          localOriginal: originals.localOriginal.map(role => role.memo),
          remoteOriginal: originals.remoteOriginal.map(role => role.memo),
          previous: JSON.parse(localStorage.getItem('roles_backup_before_sync') || '[]').map(role => role.memo),
          lastSync: document.getElementById('last-sync-time').textContent,
          phase: getSyncContentState().phase
        };
      });
      assert.match(screen.message, item.message);
      assert.equal(screen.message.includes(successText), false);
      assert.equal(screen.color, 'rgb(185, 28, 28)');
      assert.equal(screen.button, 'スプレッドシートと同期');
      assert.equal(screen.disabled, false);
      assert.deepEqual(screen.memory, ['local-kept']);
      assert.deepEqual(screen.stored, ['local-kept']);
      assert.deepEqual(screen.localOriginal, ['local-kept']);
      assert.deepEqual(screen.remoteOriginal, ['remote-kept']);
      assert.deepEqual(screen.previous, ['previous-success']);
      assert.match(screen.lastSync, /未同期/);
      assert.notEqual(screen.phase, 'verified');
      const posts = calls.filter(call => call.action === 'save').length;
      const statuses = calls.filter(call => call.action === 'fetchSaveStatus').length;
      const fetches = calls.filter(call => call.action === 'fetch').length;
      assert.equal(fetches, 1);
      assert.equal(posts, 1);
      if (item.id === 'timeout') assert.equal(statuses, 12);
      else if (item.id === 'send-fail') assert.equal(statuses, 0);
      else assert.equal(statuses, 1);
      assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
      await page.locator('#sync-message').screenshot({ path: path.join(dir, item.id + '-message.png') });
      await page.locator('#syncSheetsBtn').screenshot({ path: path.join(dir, item.id + '-button.png') });
      evidence.push({ id: item.id, label: item.label, message: screen.message, posts, statuses, fetches, local: screen.stored[0], remoteOriginal: screen.remoteOriginal[0] });
      await page.close();
    }
    assert.equal(outbound.length, 0, outbound.join('\n'));
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify({
      status: 'PASS',
      fixture: fakeUrl,
      productionEndpointUnchanged: true,
      cases: evidence,
      remoteRequestsBlocked: outbound.length
    }, null, 2));
    console.log('ROLL-002 sync stop browser PASS', evidence.map(item => item.id).join(', '));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
