import test from 'node:test';
import assert from 'node:assert/strict';
import { build, groupStandings, ranking, playerStats, suspensions, resolveSlot, bracketUpdates } from '../lib/engine.js';
import { buildDemo, weekdaysFrom, demoTiming } from '../lib/seed.js';

function mini(results, extra = {}) {
  // results: [homeIdx, awayIdx, hs, as] sur 4 équipes du groupe A
  const teams = [1, 2, 3, 4].map((i) => ({ id: i, name: `T${i}`, short: `T${i}`, grp: 'A' }));
  const players = teams.map((t) => ({ id: t.id * 10, team_id: t.id, last_name: `P${t.id}`, number: 9, position: 'A' }));
  const matches = [];
  const events = [];
  let eid = 1;
  results.forEach(([h, a, hs, as], i) => {
    matches.push({ id: i + 1, phase: 'group', grp: 'A', round: 1, code: `A${i + 1}`, kickoff: `2026-11-${16 + i}T16:00`, home_id: h, away_id: a, status: 'finished', validated: true });
    for (let g = 0; g < hs; g++) events.push({ id: eid++, match_id: i + 1, team_id: h, player_id: h * 10, type: 'goal', minute: g + 1 });
    for (let g = 0; g < as; g++) events.push({ id: eid++, match_id: i + 1, team_id: a, player_id: a * 10, type: 'goal', minute: g + 1 });
  });
  for (const c of extra.cards || []) events.push({ id: eid++, match_id: c[0], team_id: c[1], player_id: c[1] * 10, type: c[2], minute: 40 });
  return build({ settings: extra.settings || {}, teams, players, matches, events, lineups: [] });
}

test('classement : points, V/N/D, buts', () => {
  const T = mini([[1, 2, 3, 0], [3, 4, 1, 1], [1, 3, 2, 1]]);
  const st = groupStandings(T, 'A');
  assert.deepEqual(st.map((r) => r.team.id), [1, 4, 3, 2]);
  assert.deepEqual([st[0].j, st[0].v, st[0].bp, st[0].bc, st[0].diff, st[0].pts], [2, 2, 5, 1, 4, 6]);
  assert.equal(st[1].pts, 1);
  assert.equal(st[3].diff, -3);
});

test('départage : différence de buts puis buts marqués', () => {
  // T1 et T2 à 3 pts ; T1 +2, T2 +1
  let T = mini([[1, 3, 2, 0], [2, 4, 1, 0]]);
  assert.deepEqual(groupStandings(T, 'A').slice(0, 2).map((r) => r.team.id), [1, 2]);
  // même diff (+1), T2 marque plus
  T = mini([[1, 3, 1, 0], [2, 4, 3, 2]]);
  assert.deepEqual(groupStandings(T, 'A').slice(0, 2).map((r) => r.team.id), [2, 1]);
});

test('départage : confrontation directe', () => {
  // T1 bat T2 1-0 ; T2 bat T3 2-1 ; T1 perd contre T4 0-1 ; T3 bat T4... on isole T1/T2 :
  // T1 : V(1-0 vs T2), D(1-2 vs T3) -> 3 pts, 2-2 ; T2 : D(0-1), V(2-1 vs T4) -> 3 pts, 2-2
  const T = mini([[1, 2, 1, 0], [3, 1, 2, 1], [2, 4, 2, 1]]);
  const st = groupStandings(T, 'A');
  const i1 = st.findIndex((r) => r.team.id === 1);
  const i2 = st.findIndex((r) => r.team.id === 2);
  assert.equal(st[i1].pts, st[i2].pts);
  assert.equal(st[i1].diff, st[i2].diff);
  assert.equal(st[i1].bp, st[i2].bp);
  assert.ok(i1 < i2, 'T1 devant T2 grâce à la confrontation directe');
});

test('départage : fair-play puis égalité parfaite signalée', () => {
  // T1 et T2 font 1-1 entre eux : tout est égal. T1 prend un jaune -> T2 devant.
  let T = mini([[1, 2, 1, 1]], { cards: [[1, 1, 'yellow']] });
  let st = groupStandings(T, 'A');
  assert.deepEqual(st.slice(0, 2).map((r) => r.team.id), [2, 1]);
  assert.ok(!st[0].tied);
  T = mini([[1, 2, 1, 1]]);
  st = groupStandings(T, 'A');
  assert.ok(st[0].tied && st[1].tied, 'égalité parfaite signalée (groupe terminé)');
  // ordre manuel de l'organisateur
  T = mini([[1, 2, 1, 1]], { settings: { manual_order: JSON.stringify({ A: 'T2,T1' }) } });
  st = groupStandings(T, 'A');
  assert.deepEqual(st.slice(0, 2).map((r) => r.team.id), [2, 1]);
  assert.ok(!st[0].tied);
});

test('ordre des critères configurable', () => {
  // T1 : +1 avec 1 but ; T2 : +1 avec 3 buts. Par défaut T2 devant (buts marqués).
  const base = [[1, 3, 1, 0], [2, 4, 3, 2]];
  let T = mini(base, { cards: [[2, 2, 'red']] });
  assert.equal(groupStandings(T, 'A')[0].team.id, 2);
  T = mini(base, { cards: [[2, 2, 'red']], settings: { tiebreakers: JSON.stringify(['points', 'diff', 'fairplay', 'goals', 'h2h']) } });
  assert.equal(groupStandings(T, 'A')[0].team.id, 1);
});

test('seuls les résultats validés comptent', () => {
  const T0 = mini([[1, 2, 3, 0]]);
  const raw = { settings: {}, teams: T0.teams, players: T0.players, matches: T0.matches.map((m) => ({ ...m, validated: false })), events: T0.matches.flatMap((m) => m.events), lineups: [] };
  const st = groupStandings(build(raw), 'A');
  assert.ok(st.every((r) => r.j === 0 && r.pts === 0));
});

test('buteurs : rangs partagés', () => {
  const T = mini([[1, 2, 2, 2], [3, 4, 1, 0]]);
  const r = ranking(playerStats(T), 'goals');
  assert.deepEqual(r.map((x) => x.rank), [1, 1, 3]);
});

test('suspensions : rouge et 3 jaunes cumulés', () => {
  const T = mini([[1, 2, 0, 0], [1, 3, 0, 0], [1, 4, 0, 0], [2, 3, 0, 0]], { cards: [[1, 1, 'yellow'], [2, 1, 'yellow'], [3, 1, 'yellow'], [1, 2, 'red']] });
  const s = suspensions(T);
  assert.ok(s.byMatch.get(4).has(20), 'rouge au match 1 -> suspendu au match suivant de T2 (match 4)');
  assert.ok(s.pending.get(1).has(10), '3e jaune au dernier match -> suspendu au prochain match');
});

test('démo : calendrier conforme', () => {
  const d = buildDemo({ startDate: '2026-11-16', playedMatches: 10 });
  assert.equal(d.teams.length, 16);
  assert.equal(d.players.length, 208);
  assert.equal(d.matches.length, 32);
  assert.equal(d.matches.filter((m) => m.phase === 'group').length, 24);
  assert.equal(d.matches.filter((m) => m.status === 'finished').length, 10);
  // 2 matchs par jour, lundi-vendredi, groupes enchaînés A, B, C, D
  assert.deepEqual(weekdaysFrom('2026-11-16', 6), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23']);
  const byDay = {};
  for (const m of d.matches) (byDay[m.kickoff.slice(0, 10)] ||= []).push(m);
  assert.ok(Object.values(byDay).every((l) => l.length === 2));
  assert.deepEqual(Object.values(byDay).slice(0, 5).map((l) => l[0].grp + l[1].grp), ['AA', 'BB', 'CC', 'DD', 'AA']);
  // chaque équipe joue 3 matchs de groupe, contre 3 adversaires différents
  for (const t of d.teams) {
    const opp = d.matches.filter((m) => m.phase === 'group' && (m.home_id === t.id || m.away_id === t.id)).map((m) => (m.home_id === t.id ? m.away_id : m.home_id));
    assert.equal(new Set(opp).size, 3);
  }
  const T = build(d);
  assert.equal(resolveSlot(T, '1A'), null, 'groupe A incomplet : pas encore de qualifié');
  assert.equal(bracketUpdates(T).length, 0);
});

test('démo : commencée depuis une semaine', () => {
  assert.deepEqual(demoTiming('2026-11-10'), { startDate: '2026-11-02', playedMatches: 12 });
  assert.deepEqual(demoTiming('2026-11-14'), { startDate: '2026-11-02', playedMatches: 20 });
  assert.deepEqual(demoTiming('2026-11-16'), { startDate: '2026-11-09', playedMatches: 10 });
});

test('vraies équipes : groupes et calendrier sur les créneaux', async () => {
  const { buildReal, slotKickoffs } = await import('../lib/realdata.js');
  const { textToSlots, slotsToText } = await import('../lib/format.js');
  const d = buildReal();
  assert.equal(d.teams.length, 16);
  assert.equal(d.teams.filter((t) => d.players.some((p) => p.team_id === t.id)).length, 11);
  for (const g of 'ABCD') assert.equal(d.teams.filter((t) => t.grp === g).length, 4);
  assert.equal(d.matches.length, 32);
  assert.equal(d.matches[0].kickoff, '2026-11-16T20:00');
  assert.equal(d.matchesByCode, undefined);
  const wds = new Set(d.matches.map((m) => new Date(m.kickoff.slice(0, 10) + 'T00:00:00Z').getUTCDay()));
  assert.deepEqual([...wds].sort(), [1, 2, 3, 6]);
  // 5 matchs par semaine
  assert.equal(slotKickoffs('2026-11-16', d.settings.slots, 10).filter((k) => k < '2026-11-23').length, 5);
  // chaque équipe : 3 matchs de groupe contre 3 adversaires, jamais deux fois le même jour
  for (const t of d.teams) {
    const ms = d.matches.filter((m) => m.phase === 'group' && (m.home_id === t.id || m.away_id === t.id));
    assert.equal(ms.length, 3);
    assert.equal(new Set(ms.map((m) => m.kickoff.slice(0, 10))).size, 3);
  }
  // première semaine : uniquement des équipes confirmées sauf une place
  const confirmed = new Set(d.players.map((p) => p.team_id));
  const week1 = d.matches.slice(0, 5);
  assert.ok(week1.filter((m) => confirmed.has(m.home_id) && confirmed.has(m.away_id)).length >= 4);
  assert.equal(textToSlots('lun 20h, lun 22:00, mardi 20h00, mer 22:00, sam 22h'), '1-20:00,1-22:00,2-20:00,3-22:00,6-22:00');
  assert.equal(slotsToText('1-20:00,6-22:00'), 'lun 20:00, sam 22:00');
  const est = d.teams.find((t) => t.short === 'EST');
  assert.equal(d.players.filter((p) => p.team_id === est.id).length, 13);
  assert.ok(d.players.some((p) => p.last_name === 'Eritier' && p.position === 'G'));
  for (const tm of d.teams.filter((x) => d.players.some((p) => p.team_id === x.id))) assert.equal(d.players.filter((p) => p.team_id === tm.id && p.is_captain).length, 1, tm.name);
});
