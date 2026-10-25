const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (!process.env.TEST_DATABASE_URL) {
  console.error('Define TEST_DATABASE_URL para ejecutar las pruebas contra PostgreSQL.');
  process.exit(1);
}

const jestPath = require.resolve('jest/bin/jest');
const result = spawnSync(process.execPath, [jestPath, '--runInBand', '--roots', 'tests'], {
  env: { ...process.env, NODE_ENV: 'test' },
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

if (result.error) {
  console.error('No se pudo iniciar Jest:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
