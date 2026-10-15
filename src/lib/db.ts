import pg, { type PoolClient, type QueryResultRow } from 'pg';
const globalDB = globalThis as unknown as { meditoPool?: pg.Pool };
export const pool = globalDB.meditoPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== 'production') globalDB.meditoPool = pool;
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return (await pool.query<T>(text, values)).rows;
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
