// Accès Postgres. En production : pilote "pg" (Neon / Vercel Postgres).
// Les tests injectent leur propre adaptateur avec setAdapter().

let adapter = null;
let pool = null;

export function setAdapter(a) {
  adapter = a;
}

export function dbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
}

export function dbConfigured() {
  return !!adapter || !!dbUrl();
}

async function getPool() {
  if (pool) return pool;
  const mod = await import('pg');
  const pg = mod.default || mod;
  const url = dbUrl();
  const local = /localhost|127\.0\.0\.1/.test(url);
  pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000, ssl: local || /sslmode=/.test(url) ? undefined : true });
  pool.on('error', () => {});
  return pool;
}

// Requête paramétrée, renvoie les lignes.
export async function q(text, params = []) {
  if (adapter) return adapter.q(text, params);
  const p = await getPool();
  const res = await p.query(text, params);
  return res.rows;
}

// Script SQL multi-instructions (sans paramètres).
export async function exec(script) {
  if (adapter) return adapter.exec(script);
  const p = await getPool();
  const c = await p.connect();
  try {
    await c.query(script);
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {}
    throw e;
  } finally {
    c.release();
  }
}
