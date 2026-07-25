const { resetRoles, rolesFile } = require('../src/lib/store');

resetRoles()
  .then(() => console.log(`Local prototype data reset: ${rolesFile}`))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
