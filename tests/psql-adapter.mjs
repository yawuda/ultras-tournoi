// Adaptateur de test : exécute les requêtes via psql sur une base Postgres locale.
import { execFileSync } from 'node:child_process';
const DB = process.env.TEST_DB || 'ut_test';
function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function run(sql) {
  return execFileSync('psql', ['-d', DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}
export const adapter = {
  async q(text, params = []) {
    const sql = text.replace(/\$(\d+)/g, (_, n) => lit(params[n - 1]));
    const out = run(`WITH __q AS (${sql}) SELECT coalesce(json_agg(__q), '[]'::json) FROM __q;`);
    return JSON.parse(out.trim());
  },
  async exec(script) {
    run(script);
  },
};
export function resetDb() {
  run('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}
