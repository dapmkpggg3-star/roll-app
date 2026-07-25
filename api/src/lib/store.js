const fs = require('node:fs/promises');
const path = require('node:path');
const seedRoles = require('../../seed/roles.json');
const { normalizeRole } = require('./role-schema');

const dataDirectory = path.resolve(__dirname, '../../local-data');
const rolesFile = path.join(dataDirectory, 'roles.json');

async function ensureStore() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(rolesFile);
  } catch {
    await fs.writeFile(rolesFile, `${JSON.stringify(seedRoles, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  }
}

async function getRoles() {
  await ensureStore();
  const text = await fs.readFile(rolesFile, 'utf8');
  return JSON.parse(text).map(normalizeRole);
}

async function saveRoles(roles) {
  await ensureStore();
  const temporaryFile = `${rolesFile}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(roles, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryFile, rolesFile);
  return roles;
}

async function resetRoles() {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(rolesFile, `${JSON.stringify(seedRoles, null, 2)}\n`, 'utf8');
}

module.exports = { getRoles, saveRoles, resetRoles, rolesFile };
