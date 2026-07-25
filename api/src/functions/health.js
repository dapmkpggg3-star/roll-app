const { app } = require('@azure/functions');

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => ({
    jsonBody: {
      success: true,
      service: 'roll-app-microsoft-local-api',
      storage: 'local-prototype-file',
      production: false,
      checkedAt: new Date().toISOString()
    }
  })
});
