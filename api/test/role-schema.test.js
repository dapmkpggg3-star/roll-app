const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../seed/roles.json');
const { REQUIRED_ROLE_FIELDS, validateRolesPayload } = require('../src/lib/role-schema');

test('fictional seed preserves all Roles A-P fields', () => {
  const roles = validateRolesPayload({ roles: seed });
  roles.forEach(role => REQUIRED_ROLE_FIELDS.forEach(field => assert.ok(field in role)));
});

test('invalid date and missing fields are rejected', () => {
  const invalid = { ...seed[0], useStartDate: '25/99/1' };
  assert.throws(() => validateRolesPayload({ roles: [invalid] }));
  const { history, ...missingHistory } = seed[0];
  assert.throws(() => validateRolesPayload({ roles: [missingHistory] }));
});

test('next assembly requires active three-set boolean', () => {
  const role = { ...seed[0], isActiveThreeSet: false, nextAssemblyPlanned: true };
  assert.equal(validateRolesPayload({ roles: [role] })[0].nextAssemblyPlanned, false);
});
