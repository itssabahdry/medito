import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
const db = new EmbeddedPostgres({
  databaseDir: './data/local-postgres',
  user: 'medito',
  password: process.env.POSTGRES_PASSWORD,
  port: 55432,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (message) => console.error(String(message).slice(0, 200)),
});
if (!process.env.POSTGRES_PASSWORD)
  throw new Error('Set POSTGRES_PASSWORD in .env');
if (!existsSync('./data/local-postgres/PG_VERSION')) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname='medito'"))
    .rowCount
)
  await client.query(
    "CREATE DATABASE medito WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
  );
await client.end();
console.log(
  'Local PostgreSQL ready on 127.0.0.1:55432. Stop this command to stop PostgreSQL.',
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
