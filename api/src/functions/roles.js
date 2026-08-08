const { app } = require('@azure/functions');
const store = require('../lib/store');
const { validateRolesPayload } = require('../lib/role-schema');
const { validateRolesOnlineTransition } = require('../lib/online-safety');

app.http('roles', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'roles',
  handler: async request => {
    try {
      if (request.method === 'GET') {
        return { jsonBody: { success: true, roles: await store.getRoles(), storage: 'local-prototype-file' } };
      }
      const roles = validateRolesPayload(await request.json());
      validateRolesOnlineTransition(await store.getRoles(), roles);
      await store.saveRoles(roles);
      return { jsonBody: { success: true, roles, savedCount: roles.length, storage: 'local-prototype-file' } };
    } catch (error) {
      return { status: 400, jsonBody: { success: false, error: error.message } };
    }
  }
});
