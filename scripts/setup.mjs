import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const password = randomBytes(24).toString('hex');
const adminPassword = randomBytes(20).toString('hex');
const demoPassword = randomBytes(20).toString('hex');
try {
  await writeFile('.env', [
    'POSTGRES_DB=medito', 'POSTGRES_USER=medito', 'POSTGRES_PASSWORD=' + password,
    'DATABASE_URL=postgresql://medito:' + password + '@127.0.0.1:55432/medito',
    'APP_URL=http://localhost:3000', 'UPLOAD_DIR=./data/documents',
    'ADMIN_EMAIL=admin@medito.local', 'ADMIN_PASSWORD=' + adminPassword,
    'DEMO_DATA=false', 'DEMO_PASSWORD=' + demoPassword,
    'OPENAI_API_KEY=', 'OPENAI_MODEL=', 'TURN_URL=', 'TURN_USERNAME=', 'TURN_CREDENTIAL=', ''
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created .env with random database, administrator and demo passwords. Read it locally; do not commit it.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; it was preserved.');
}
