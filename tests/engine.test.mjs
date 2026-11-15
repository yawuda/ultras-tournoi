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

test('vraies équipes : 2 groupes et programme officiel', async () => {
  const { buildReal, slotKickoffs, officialSchedule, buildSchedule } = await import('../lib/realdata.js');
  const { textToSlots, slotsToText } = await import('../lib/format.js');
  const { directSpots, bestThirdsCount, slotLabel, matchTitle } = await import('../lib/engine.js');
  const d = buildReal();
  assert.equal(d.teams.length, 13);
  assert.equal(d.players.length, 163);
  const names = (g) => d.teams.filter((t) => t.grp === g).map((t) => t.name).sort((a, b) => a.localeCompare(b, 'fr'));
  assert.deepEqual(names('A'), ['Espérance de Tunis (EST)', 'Les Aigles', 'Panthers Team', 'Smart Construction', 'Star Group (SG)', 'Sunrise Team', 'Z Team']);
  assert.deepEqual(names('B'), ['Bokutani', 'G.M.K', 'Nsarieh', 'Tasty Life', 'Tequila', 'U18']);
  assert.equal(d.matches.length, 33);
  const group = d.matches.filter((m) => m.phase === 'group');
  assert.equal(group.length, 26);
  assert.equal(group.filter((m) => m.grp === 'A').length, 14);
  assert.equal(group.filter((m) => m.grp === 'B').length, 12);
  // programme officiel : quelques affiches datées
  const nm = Object.fromEntries(d.teams.map((t) => [t.id, t.name]));
  const at = (k) => { const m = d.matches.find((x) => x.kickoff === k); return m.home_id ? `${nm[m.home_id]} - ${nm[m.away_id]}` : `${m.code}:${m.home_src}-${m.away_src}`; };
  assert.equal(at('2026-11-16T20:00'), 'Panthers Team - Smart Construction');
  assert.equal(at('2026-11-16T22:00'), 'Nsarieh - Tequila');
  assert.equal(at('2026-11-18T20:00'), 'Z Team - Espérance de Tunis (EST)');
  assert.equal(at('2026-11-18T22:00'), 'Star Group (SG) - Sunrise Team');
  assert.equal(at('2026-12-14T22:00'), 'Bokutani - Tasty Life');
  assert.equal(at('2026-12-15T20:00'), 'QF1:1A-4B');
  assert.equal(at('2026-12-26T22:00'), 'F:W:DF1-W:DF2');
  const ko = d.matches.slice(26).map((m) => `${m.code}:${m.home_src}-${m.away_src}`);
  assert.deepEqual(ko, ['QF1:1A-4B', 'QF2:2A-3B', 'QF3:1B-4A', 'QF4:2B-3A', 'DF1:W:QF1-W:QF3', 'DF2:W:QF2-W:QF4', 'F:W:DF1-W:DF2']);
  // tous les matchs tombent sur un créneau hebdomadaire, un seul match par créneau
  const slots = new Set(slotKickoffs('2026-11-16', d.settings.slots, 60));
  assert.ok(d.matches.every((m) => slots.has(m.kickoff)));
  assert.equal(new Set(d.matches.map((m) => m.kickoff)).size, 33);
  assert.equal(slotKickoffs('2026-11-16', d.settings.slots, 10).filter((k) => k < '2026-11-23').length, 6);
  // chaque équipe joue 4 matchs de groupe, contre 4 adversaires différents de son groupe, jamais deux fois le même jour
  for (const t of d.teams) {
    const ms = group.filter((m) => m.home_id === t.id || m.away_id === t.id);
    assert.equal(ms.length, 4, t.name);
    assert.ok(ms.every((m) => m.grp === t.grp), t.name);
    assert.equal(new Set(ms.map((m) => (m.home_id === t.id ? m.away_id : m.home_id))).size, 4);
    assert.equal(new Set(ms.map((m) => m.kickoff.slice(0, 10))).size, 4, `${t.name} joue deux fois le même jour`);
  }
  // Panthers Team : matchs de groupes à 20h
  const pan = d.teams.find((t) => t.short === 'PAN').id;
  assert.ok(group.filter((m) => m.home_id === pan || m.away_id === pan).every((m) => m.kickoff.endsWith('T20:00')));
  // les quarts commencent après le dernier match de groupe
  const lastGroup = group.map((m) => m.kickoff).sort().pop();
  assert.ok(d.matches.filter((m) => m.phase === 'qf').every((m) => m.kickoff > lastGroup));
  // 4 qualifiés par groupe, pas de meilleurs 3es
  const T = build(d);
  assert.equal(directSpots(T), 4);
  assert.equal(bestThirdsCount(T), 0);
  assert.equal(slotLabel('4B'), '4e Groupe B');
  assert.equal(matchTitle(T.matches[0]), 'Groupe A');
  // groupes modifiés : plus de programme officiel, calendrier automatique à 2 groupes
  const moved = d.teams.map((t) => (t.short === 'ZT' ? { ...t, grp: 'B' } : t));
  assert.equal(officialSchedule(moved), null);
  const auto = buildSchedule(moved);
  assert.equal(auto.filter((m) => m.phase === 'group').length, 15 + 21);
  assert.equal(auto.filter((m) => m.phase !== 'group').length, 7);
  assert.equal(textToSlots('lun 20h, lun 22:00, mardi 20h00, mer 20h, mer 22:00, sam 22h'), '1-20:00,1-22:00,2-20:00,3-20:00,3-22:00,6-22:00');
  assert.equal(slotsToText('1-20:00,6-22:00'), 'lun 20:00, sam 22:00');
  // effectifs du 14 novembre
  const squad = (short) => d.players.filter((p) => p.team_id === d.teams.find((t) => t.short === short).id);
  const sizes = Object.fromEntries(d.teams.map((t) => [t.short, squad(t.short).length]));
  assert.deepEqual(sizes, { SUN: 13, TL: 13, SG: 10, GMK: 13, U18: 11, PAN: 14, SMC: 12, NSA: 11, EST: 13, AIG: 13, ZT: 12, BOK: 14, TEQ: 14 });
  assert.ok(squad('TEQ').find((p) => p.last_name === 'Tiger').is_captain);
  assert.equal(squad('TEQ').find((p) => p.last_name === 'Kambamba').position, 'G');
  assert.ok(squad('SG').some((p) => p.last_name === 'Kabongo Tshilumba Gabriel (KBG)'));
  assert.ok(squad('U18').some((p) => p.last_name === 'Sabra') && !squad('U18').some((p) => p.last_name === 'Merlin'));
  for (const tm of d.teams) assert.equal(d.players.filter((p) => p.team_id === tm.id && p.is_captain).length, 1, tm.name);
});

test('meilleurs 3es : comparaison à la moyenne par match', async () => {
  const { crossRank } = await import('../lib/engine.js');
  const row = (id, grp, j, pts, diff, bp) => ({ team: { id, grp }, j, pts, diff, bp, fp: 0 });
  // 4 matchs à 6 pts (1,5/m) < 3 matchs à 6 pts (2/m)
  const r = crossRank([row(1, 'A', 4, 6, 2, 6), row(2, 'B', 3, 6, 0, 3), row(3, 'C', 3, 4, 5, 9)]);
  assert.deepEqual(r.map((x) => x.team.id), [2, 1, 3]);
});
