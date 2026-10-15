import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
const run = (args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Check failed: ' + args.join(' '))),
    );
  });
let embedded, admin, uploadDir;
const databaseName = 'medito_test_' + randomBytes(6).toString('hex');
try {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const password = 'medito-test-only';
    embedded = new EmbeddedPostgres({
      databaseDir: './data/test-postgres-utf8',
      user: 'postgres',
      password,
      port: 55433,
      persistent: true,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      postgresFlags: ['-h', '127.0.0.1'],
      onLog: () => {},
      onError: () => {},
    });
    if (!existsSync('./data/test-postgres-utf8/PG_VERSION'))
      await embedded.initialise();
    await embedded.start();
    url = 'postgresql://postgres:' + password + '@127.0.0.1:55433/postgres';
  }
  admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(
    'CREATE DATABASE ' +
      databaseName +
      " WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
  );
  const testUrl = new URL(url);
  testUrl.pathname = '/' + databaseName;
  await mkdir('data', { recursive: true });
  uploadDir = await mkdtemp(path.resolve('data/test-uploads-'));
  const env = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    UPLOAD_DIR: uploadDir,
    APP_URL: 'http://localhost:3000',
    OPENAI_API_KEY: '',
    OPENAI_MODEL: '',
  };
  await run(['scripts/migrate.mjs'], env);
  const files = (await readdir('tests'))
    .filter((x) => x.endsWith('.test.ts'))
    .map((x) => 'tests/' + x);
  await run(['--import', 'tsx', '--test', ...files], env);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (admin) {
    await admin
      .query('DROP DATABASE IF EXISTS ' + databaseName + ' WITH (FORCE)')
      .catch(() => {});
    await admin.end();
  }
  if (embedded) await embedded.stop();
  if (uploadDir && uploadDir.startsWith(path.resolve('data') + path.sep))
    await rm(uploadDir, { recursive: true, force: true });
}
