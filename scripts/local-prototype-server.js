const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const store = require('../api/src/lib/store');
const { validateRolesPayload } = require('../api/src/lib/role-schema');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4280);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleApi(request, response, pathname) {
  if (pathname === '/api/health' && request.method === 'GET') {
    return json(response, 200, {
      success: true, service: 'roll-app-microsoft-local-api',
      storage: 'local-prototype-file', production: false, checkedAt: new Date().toISOString()
    });
  }
  if (pathname === '/api/roles' && request.method === 'GET') {
    return json(response, 200, { success: true, roles: await store.getRoles(), storage: 'local-prototype-file' });
  }
  if (pathname === '/api/roles' && request.method === 'POST') {
    try {
      const roles = validateRolesPayload(await readJson(request));
      await store.saveRoles(roles);
      return json(response, 200, { success: true, roles, savedCount: roles.length, storage: 'local-prototype-file' });
    } catch (error) {
      return json(response, 400, { success: false, error: error.message });
    }
  }
  if (pathname === '/api/master-data' && request.method === 'GET') {
    return json(response, 200, {
      success: true,
      standMaster: [
        { stand: '2', newDiameter: 610, scrapDiameter: 400, leadTimeMonths: 6 },
        { stand: '3', newDiameter: 590, scrapDiameter: 400, leadTimeMonths: 6 },
        { stand: '4', newDiameter: 560, scrapDiameter: 400, leadTimeMonths: 6 }
      ],
      cuttingMaster: []
    });
  }
  return json(response, 404, { success: false, error: 'API route not found' });
}

async function handleStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root + path.sep)) return json(response, 403, { success: false, error: 'Forbidden' });
  try {
    const body = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    const body = await fs.readFile(path.join(root, 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(body);
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    if (pathname.startsWith('/api/')) return await handleApi(request, response, pathname);
    return await handleStatic(response, pathname);
  } catch (error) {
    return json(response, 500, { success: false, error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Microsoft local prototype: http://localhost:${port}`);
  console.log('Local file storage only; production: false');
});
