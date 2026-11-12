export const SCHEMA_SQL = `
BEGIN;
SELECT pg_advisory_xact_lock(771001);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL,
  role TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, grp TEXT,
  coach TEXT, logo_url TEXT, color TEXT);
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name TEXT, last_name TEXT NOT NULL, number INTEGER, position TEXT, photo_url TEXT,
  is_captain BOOLEAN NOT NULL DEFAULT false);
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY, phase TEXT NOT NULL, grp TEXT, round INTEGER, code TEXT,
  kickoff TEXT, venue TEXT,
  home_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  away_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  home_src TEXT, away_src TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', validated BOOLEAN NOT NULL DEFAULT false,
  period TEXT NOT NULL DEFAULT '', period_started_at DOUBLE PRECISION,
  started_at TEXT, ended_at TEXT, home_pens INTEGER, away_pens INTEGER,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_demo BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY, match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  type TEXT NOT NULL, minute INTEGER,
  assist_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  player_in_id INTEGER REFERENCES players(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS lineups (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL, starter BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (match_id, player_id));
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY, at TEXT NOT NULL, username TEXT, action TEXT NOT NULL,
  match_id INTEGER, detail TEXT);
CREATE INDEX IF NOT EXISTS events_match_idx ON events(match_id);
CREATE INDEX IF NOT EXISTS players_team_idx ON players(team_id);
COMMIT;
`;

export const STATE_SQL = `SELECT
  (SELECT coalesce(json_object_agg(key, value), '{}'::json) FROM settings) AS settings,
  (SELECT coalesce(json_agg(t), '[]'::json) FROM teams t) AS teams,
  (SELECT coalesce(json_agg(p), '[]'::json) FROM players p) AS players,
  (SELECT coalesce(json_agg(m), '[]'::json) FROM matches m) AS matches,
  (SELECT coalesce(json_agg(e), '[]'::json) FROM events e) AS events,
  (SELECT coalesce(json_agg(l), '[]'::json) FROM lineups l) AS lineups`;
