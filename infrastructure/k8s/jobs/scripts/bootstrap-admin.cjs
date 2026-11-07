// Explicit one-off application context, not a web server. Uses Auth's own seeder.
require('/app/node_modules/reflect-metadata');
const { NestFactory } = require('/app/node_modules/@nestjs/core');
const { AppModule } = require('/app/dist/app.module');
NestFactory.createApplicationContext(AppModule, { logger: false })
  .then(app => app.close())
  .then(() => console.log('Auth bootstrap completed; existing account credentials were not changed.'))
  .catch(() => { console.error('Auth bootstrap failed; inspect configuration privately.'); process.exitCode=1; });
