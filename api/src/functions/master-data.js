const { app } = require('@azure/functions');

app.http('master-data', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'master-data',
  handler: async () => ({
    jsonBody: {
      success: true,
      standMaster: [
        { stand: '2', newDiameter: 610, scrapDiameter: 400, leadTimeMonths: 6 },
        { stand: '3', newDiameter: 590, scrapDiameter: 400, leadTimeMonths: 6 },
        { stand: '4', newDiameter: 560, scrapDiameter: 400, leadTimeMonths: 6 }
      ],
      cuttingMaster: []
    }
  })
});
