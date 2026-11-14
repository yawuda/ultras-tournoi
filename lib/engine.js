// Moteur du tournoi : fonctions pures, sans base de données.
// Tout (scores, classements, qualifications, statistiques) est calculé
// à partir des matchs et des événements enregistrés.

export const DEFAULT_TIEBREAKERS = ['points', 'diff', 'goals', 'h2h', 'fairplay'];
export const TIEBREAKER_LABELS = {
  points: 'Points',
  diff: 'Différence de buts',
  goals: 'Buts marqués',
  h2h: 'Confrontation directe',
  fairplay: 'Fair-play (moins de cartons)',
};
export const PHASE_LABELS = {
  group: 'Phase de groupes',
  qf: 'Quarts de finale',
  sf: 'Demi-finales',
  fifth: 'Match pour la 5e place',
  third: 'Match pour la 3e place',
  final: 'Finale',
};
export const POSITION_LABELS = { G: 'Gardien', D: 'Défenseur', M: 'Milieu', A: 'Attaquant' };
export const GROUPS = ['A', 'B', 'C', 'D'];
// Groupes réellement utilisés par les équipes (ex. A, B, C)
export function groupsOf(T) {
  return [...new Set(T.teams.map((t) => t.grp).filter(Boolean))].sort();
}
export const RUNNING_PERIODS = ['1H', '2H', 'ET1', 'ET2'];
export const PERIOD_LABELS = {
  '': 'Avant-match',
  '1H': '1re mi-temps',
  HT: 'Mi-temps',
  '2H': '2e mi-temps',
  FT: 'Fin du temps réglementaire',
  ET1: 'Prolongation 1',
  ETB: 'Pause prolongation',
  ET2: 'Prolongation 2',
  PEN: 'Tirs au but',
};

export function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function getTiebreakers(settings) {
  try {
    const arr = JSON.parse(settings?.tiebreakers || 'null');
    if (Array.isArray(arr) && arr.length) {
      const ok = arr.filter((c) => DEFAULT_TIEBREAKERS.includes(c));
      for (const c of DEFAULT_TIEBREAKERS) if (!ok.includes(c)) ok.push(c);
      return ok;
    }
  } catch {}
  return DEFAULT_TIEBREAKERS;
}

function byKickoff(a, b) {
  return (a.kickoff || '').localeCompare(b.kickoff || '') || a.id - b.id;
}

// Construit la vue complète du tournoi à partir des données brutes.
export function build(state) {
  const settings = state.settings || {};
  const teams = [...state.teams].sort((a, b) => a.id - b.id);
  const players = [...state.players].sort((a, b) => a.team_id - b.team_id || (b.is_captain ? 1 : 0) - (a.is_captain ? 1 : 0) || num(a.number) - num(b.number) || a.id - b.id);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const eventsByMatch = new Map();
  for (const e of state.events) {
    if (!eventsByMatch.has(e.match_id)) eventsByMatch.set(e.match_id, []);
    eventsByMatch.get(e.match_id).push(e);
  }
  const lineupsByMatch = new Map();
  for (const l of state.lineups || []) {
    if (!lineupsByMatch.has(l.match_id)) lineupsByMatch.set(l.match_id, []);
    lineupsByMatch.get(l.match_id).push(l);
  }
  const matches = [...state.matches].sort(byKickoff).map((m) => {
    const events = (eventsByMatch.get(m.id) || []).sort((a, b) => num(a.minute) - num(b.minute) || a.id - b.id);
    let hs = 0;
    let as = 0;
    for (const e of events) {
      if (e.type === 'goal') {
        if (e.team_id === m.home_id) hs++;
        else if (e.team_id === m.away_id) as++;
      } else if (e.type === 'own_goal') {
        if (e.team_id === m.home_id) as++;
        else if (e.team_id === m.away_id) hs++;
      }
    }
    let winner_id = null;
    let loser_id = null;
    if (m.status === 'finished' && m.home_id && m.away_id) {
      let side = hs > as ? 'h' : as > hs ? 'a' : null;
      if (!side && m.home_pens != null && m.away_pens != null && m.home_pens !== m.away_pens) {
        side = m.home_pens > m.away_pens ? 'h' : 'a';
      }
      if (side) {
        winner_id = side === 'h' ? m.home_id : m.away_id;
        loser_id = side === 'h' ? m.away_id : m.home_id;
      }
    }
    return {
      ...m,
      hs,
      as,
      events,
      lineup: lineupsByMatch.get(m.id) || [],
      home: teamById.get(m.home_id) || null,
      away: teamById.get(m.away_id) || null,
      winner_id,
      loser_id,
      official: m.status === 'finished' && !!m.validated,
    };
  });
  matches.forEach((m, i) => (m.num = i + 1));
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const matchByCode = new Map(matches.map((m) => [m.code, m]));
  return { settings, teams, players, teamById, playerById, matches, matchById, matchByCode, tiebreakers: getTiebreakers(settings) };
}

function cmpKeys(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
}

// Classement d'un groupe. Seuls les résultats validés comptent.
export function groupStandings(T, grp) {
  const teams = T.teams.filter((t) => t.grp === grp);
  const official = T.matches.filter((m) => m.phase === 'group' && m.grp === grp && m.official && m.home_id && m.away_id);
  const rows = new Map(
    teams.map((t) => [t.id, { team: t, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, diff: 0, pts: 0, fp: 0 }])
  );
  for (const m of official) {
    const h = rows.get(m.home_id);
    const a = rows.get(m.away_id);
    if (!h || !a) continue;
    h.j++;
    a.j++;
    h.bp += m.hs;
    h.bc += m.as;
    a.bp += m.as;
    a.bc += m.hs;
    if (m.hs > m.as) {
      h.v++;
      a.d++;
      h.pts += 3;
    } else if (m.hs < m.as) {
      a.v++;
      h.d++;
      a.pts += 3;
    } else {
      h.n++;
      a.n++;
      h.pts++;
      a.pts++;
    }
    for (const e of m.events) {
      const r = rows.get(e.team_id);
      if (!r) continue;
      if (e.type === 'yellow') r.fp += 1;
      if (e.type === 'red') r.fp += 3;
    }
  }
  for (const r of rows.values()) r.diff = r.bp - r.bc;

  let manual = [];
  try {
    const mo = JSON.parse(T.settings.manual_order || '{}');
    manual = String(mo[grp] || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  } catch {}
  const manualIdx = (t) => {
    const i = manual.findIndex((s) => s === String(t.short || '').toLowerCase() || s === String(t.name || '').toLowerCase());
    return i < 0 ? 999 : i;
  };

  const h2hKey = (subset) => {
    const ids = new Set(subset.map((r) => r.team.id));
    const mini = new Map(subset.map((r) => [r.team.id, [0, 0, 0]]));
    for (const m of official) {
      if (!ids.has(m.home_id) || !ids.has(m.away_id)) continue;
      const h = mini.get(m.home_id);
      const a = mini.get(m.away_id);
      h[1] += m.hs - m.as;
      a[1] += m.as - m.hs;
      h[2] += m.hs;
      a[2] += m.as;
      if (m.hs > m.as) h[0] += 3;
      else if (m.hs < m.as) a[0] += 3;
      else {
        h[0]++;
        a[0]++;
      }
    }
    return (r) => mini.get(r.team.id);
  };

  const groupDone = groupComplete(T, grp);
  const criteria = T.tiebreakers;
  const rank = (subset, i) => {
    if (subset.length <= 1) return subset;
    if (i >= criteria.length) {
      const sorted = [...subset].sort((a, b) => manualIdx(a.team) - manualIdx(b.team) || a.team.id - b.team.id);
      const unresolved = sorted.every((r) => manualIdx(r.team) === 999) || new Set(sorted.map((r) => manualIdx(r.team))).size < sorted.length;
      if (unresolved && groupDone) for (const r of sorted) r.tied = true;
      return sorted;
    }
    const c = criteria[i];
    let keyOf;
    if (c === 'points') keyOf = (r) => [r.pts];
    else if (c === 'diff') keyOf = (r) => [r.diff];
    else if (c === 'goals') keyOf = (r) => [r.bp];
    else if (c === 'fairplay') keyOf = (r) => [-r.fp];
    else keyOf = h2hKey(subset);
    const keyed = subset.map((r) => ({ r, k: keyOf(r) })).sort((a, b) => cmpKeys(a.k, b.k));
    const out = [];
    let bucket = [keyed[0]];
    for (let j = 1; j <= keyed.length; j++) {
      if (j < keyed.length && cmpKeys(keyed[j].k, bucket[0].k) === 0) bucket.push(keyed[j]);
      else {
        out.push(...rank(bucket.map((x) => x.r), i + 1));
        if (j < keyed.length) bucket = [keyed[j]];
      }
    }
    return out;
  };
  const ranked = rank([...rows.values()], 0);
  ranked.forEach((r, i) => (r.pos = i + 1));
  return ranked;
}

export function groupMatches(T, grp) {
  return T.matches.filter((m) => m.phase === 'group' && m.grp === grp);
}

export function groupComplete(T, grp) {
  const ms = groupMatches(T, grp);
  return ms.length > 0 && ms.every((m) => m.official);
}

const KO_NAMES = { QF: 'quart', DF: 'demi' };
function koName(code) {
  const x = /^(QF|DF)(\d)$/.exec(code);
  return x ? `${KO_NAMES[x[1]]} ${x[2]}` : code;
}
export function slotLabel(src) {
  if (!src) return 'À déterminer';
  let x = /^([123])([A-D])$/.exec(src);
  if (x) return `${x[1] === '1' ? '1er' : `${x[1]}e`} Groupe ${x[2]}`;
  if (src === '3*1') return 'Meilleur 3e';
  if (src === '3*2') return '2e meilleur 3e';
  if (src === 'QL1') return 'Meilleur perdant des quarts';
  if (src === 'QL2') return '2e meilleur perdant des quarts';
  x = /^W:(.+)$/.exec(src);
  if (x) return `Vainqueur ${koName(x[1])}`;
  x = /^L:(.+)$/.exec(src);
  if (x) return `Perdant ${koName(x[1])}`;
  return src;
}

// Comparaison entre groupes de tailles différentes : moyennes par match.
// 1. points par match, 2. différence de buts par match, 3. buts marqués par match, 4. moins de cartons par match.
export const CROSS_LABELS = ['Points par match', 'Différence de buts par match', 'Buts marqués par match', 'Fair-play (cartons par match)'];
export function crossKey(r) {
  const j = r.j || 1;
  return [r.pts / j, r.diff / j, r.bp / j, -r.fp / j];
}
export function crossRank(rows) {
  return [...rows].sort((a, b) => {
    const ka = crossKey(a);
    const kb = crossKey(b);
    for (let i = 0; i < ka.length; i++) if (Math.abs(ka[i] - kb[i]) > 1e-9) return kb[i] - ka[i];
    return String(a.team.grp).localeCompare(String(b.team.grp)) || a.team.id - b.team.id;
  });
}
export function allGroupsComplete(T) {
  const gs = groupsOf(T);
  return gs.length > 0 && gs.every((g) => groupComplete(T, g));
}
// Classement des 3es de groupe (provisoire tant que les groupes ne sont pas terminés).
export function thirdsRanking(T) {
  const rows = [];
  for (const g of groupsOf(T)) {
    const r = groupStandings(T, g)[2];
    if (r) rows.push({ ...r, grp: g });
  }
  return crossRank(rows);
}
// Les perdants des quarts, classés selon leur parcours en phase de groupes.
export function quarterLosersRanking(T) {
  const qfs = T.matches.filter((m) => m.phase === 'qf');
  if (!qfs.length || !qfs.every((m) => m.official)) return null;
  const rows = [];
  for (const m of qfs) {
    const id = m.loser_id;
    const t = T.teamById.get(id);
    if (!t) continue;
    const r = groupStandings(T, t.grp).find((x) => x.team.id === id);
    if (r) rows.push({ ...r, grp: t.grp });
  }
  return crossRank(rows);
}

export function resolveSlot(T, src) {
  if (!src) return null;
  let x = /^([123])([A-D])$/.exec(src);
  if (x) {
    if (!groupComplete(T, x[2])) return null;
    const st = groupStandings(T, x[2]);
    return st[Number(x[1]) - 1]?.team.id ?? null;
  }
  x = /^3\*([12])$/.exec(src);
  if (x) {
    if (!allGroupsComplete(T)) return null;
    return thirdsRanking(T)[Number(x[1]) - 1]?.team.id ?? null;
  }
  x = /^QL([12])$/.exec(src);
  if (x) {
    const r = quarterLosersRanking(T);
    return r ? r[Number(x[1]) - 1]?.team.id ?? null : null;
  }
  x = /^([WL]):(.+)$/.exec(src);
  if (x) {
    const m = T.matchByCode.get(x[2]);
    if (!m || !m.official) return null;
    return x[1] === 'W' ? m.winner_id : m.loser_id;
  }
  return null;
}

// Affiches des phases finales à mettre à jour (matchs pas encore commencés uniquement).
export function bracketUpdates(T) {
  const out = [];
  for (const m of T.matches) {
    if (m.phase === 'group' || m.status !== 'scheduled') continue;
    if (!m.home_src && !m.away_src) continue;
    const h = m.home_src ? resolveSlot(T, m.home_src) : m.home_id;
    const a = m.away_src ? resolveSlot(T, m.away_src) : m.away_id;
    if ((h ?? null) !== (m.home_id ?? null) || (a ?? null) !== (m.away_id ?? null)) out.push({ id: m.id, home_id: h ?? null, away_id: a ?? null });
  }
  return out;
}

// Nombre de 3es qualifiés : déduit du tableau final (« 3*1 », « 3*2 »).
export function bestThirdsCount(T) {
  return T.matches.filter((m) => m.phase === 'qf').flatMap((m) => [m.home_src, m.away_src]).filter((s) => /^3\*\d$/.test(s || '')).length;
}
export function qualifiedTeams(T) {
  const out = [];
  for (const g of groupsOf(T)) {
    if (!groupComplete(T, g)) continue;
    const st = groupStandings(T, g);
    for (const r of st.slice(0, 2)) out.push({ team: r.team, grp: g, pos: r.pos });
  }
  const n = bestThirdsCount(T);
  if (n && allGroupsComplete(T)) for (const r of thirdsRanking(T).slice(0, n)) out.push({ team: r.team, grp: r.grp, pos: 3 });
  return out;
}

export function playerStats(T) {
  const stats = new Map(T.players.map((p) => [p.id, { player: p, team: T.teamById.get(p.team_id), mj: 0, goals: 0, assists: 0, yellow: 0, red: 0 }]));
  for (const m of T.matches) {
    if (m.status === 'scheduled') continue;
    const seen = new Set();
    for (const l of m.lineup) if (l.starter) seen.add(l.player_id);
    for (const e of m.events) {
      const s = stats.get(e.player_id);
      if (e.type === 'goal') {
        if (s) s.goals++;
        const a = stats.get(e.assist_id);
        if (a) {
          a.assists++;
          seen.add(e.assist_id);
        }
      } else if (e.type === 'yellow' && s) s.yellow++;
      else if (e.type === 'red' && s) s.red++;
      if (e.type === 'sub' && e.player_in_id) seen.add(e.player_in_id);
      if (e.player_id) seen.add(e.player_id);
    }
    for (const id of seen) {
      const s = stats.get(id);
      if (s) s.mj++;
    }
  }
  return stats;
}

// Classement avec rangs partagés en cas d'égalité (1, 2, 2, 4...).
export function ranking(statsMap, key) {
  const list = [...statsMap.values()].filter((s) => s[key] > 0).sort((a, b) => b[key] - a[key] || (a.player.last_name || '').localeCompare(b.player.last_name || ''));
  let rank = 0;
  let prev = null;
  return list.map((s, i) => {
    if (s[key] !== prev) {
      rank = i + 1;
      prev = s[key];
    }
    return { ...s, rank, value: s[key] };
  });
}

export function teamRecord(T, teamId) {
  const r = { j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, yellow: 0, red: 0 };
  for (const m of T.matches) {
    if (m.status !== 'finished') continue;
    const home = m.home_id === teamId;
    if (!home && m.away_id !== teamId) continue;
    const f = home ? m.hs : m.as;
    const c = home ? m.as : m.hs;
    r.j++;
    r.bp += f;
    r.bc += c;
    if (f > c) r.v++;
    else if (f < c) r.d++;
    else r.n++;
    for (const e of m.events) {
      if (e.team_id !== teamId) continue;
      if (e.type === 'yellow') r.yellow++;
      if (e.type === 'red') r.red++;
    }
  }
  return r;
}

export function tournamentStats(T) {
  const finished = T.matches.filter((m) => m.status === 'finished');
  let goals = 0;
  let yellow = 0;
  let red = 0;
  for (const m of T.matches) {
    if (m.status === 'scheduled') continue;
    goals += m.hs + m.as;
    for (const e of m.events) {
      if (e.type === 'yellow') yellow++;
      if (e.type === 'red') red++;
    }
  }
  const finishedGoals = finished.reduce((s, m) => s + m.hs + m.as, 0);
  const recs = T.teams.map((t) => ({ team: t, ...teamRecord(T, t.id) })).filter((r) => r.j > 0);
  const maxBp = Math.max(-1, ...recs.map((r) => r.bp));
  const minBc = Math.min(999, ...recs.map((r) => r.bc));
  return {
    played: finished.length,
    total: T.matches.length,
    goals,
    avg: finished.length ? finishedGoals / finished.length : 0,
    yellow,
    red,
    bestAttack: recs.filter((r) => r.bp === maxBp),
    bestDefense: recs.filter((r) => r.bc === minBc),
  };
}

// Suspensions : 1 match après un carton rouge, 1 match tous les N cartons jaunes cumulés.
export function suspensions(T) {
  const threshold = Math.max(1, num(T.settings.yellow_suspension, 3));
  const byMatch = new Map(); // matchId -> Set(playerId)
  const pending = new Map(); // teamId -> Set(playerId), prochain match pas encore connu
  for (const t of T.teams) {
    const ms = T.matches.filter((m) => m.home_id === t.id || m.away_id === t.id);
    const yellows = new Map();
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.status !== 'finished') continue;
      const out = new Set();
      for (const e of m.events) {
        if (e.team_id !== t.id || !e.player_id) continue;
        if (e.type === 'red') out.add(e.player_id);
        if (e.type === 'yellow') {
          const before = yellows.get(e.player_id) || 0;
          yellows.set(e.player_id, before + 1);
          if (Math.floor((before + 1) / threshold) > Math.floor(before / threshold)) out.add(e.player_id);
        }
      }
      if (!out.size) continue;
      const next = ms[i + 1];
      if (next) {
        if (!byMatch.has(next.id)) byMatch.set(next.id, new Set());
        for (const id of out) byMatch.get(next.id).add(id);
      } else {
        if (!pending.has(t.id)) pending.set(t.id, new Set());
        for (const id of out) pending.get(t.id).add(id);
      }
    }
  }
  return { byMatch, pending };
}

export function periodBase(settings, period) {
  const half = num(settings.half_minutes, 25);
  const et = num(settings.et_minutes, 10);
  if (period === '1H') return { base: 0, cap: half };
  if (period === '2H') return { base: half, cap: half * 2 };
  if (period === 'ET1') return { base: half * 2, cap: half * 2 + et };
  if (period === 'ET2') return { base: half * 2 + et, cap: half * 2 + et * 2 };
  return null;
}

export function liveMinute(match, settings, now = Date.now()) {
  const pb = periodBase(settings, match.period);
  if (!pb || !match.period_started_at) return null;
  const el = Math.max(0, Math.floor((now - num(match.period_started_at)) / 60000));
  return Math.min(pb.base + el + 1, pb.cap + 30);
}

export function liveLabel(match, settings, now = Date.now()) {
  const pb = periodBase(settings, match.period);
  if (pb) {
    const min = liveMinute(match, settings, now);
    if (min == null) return PERIOD_LABELS[match.period];
    return min > pb.cap ? `${pb.cap}'+${min - pb.cap}` : `${min}'`;
  }
  return PERIOD_LABELS[match.period || ''] || 'En cours';
}

export function tournamentStatus(T) {
  const final = T.matches.find((m) => m.phase === 'final');
  if (final && final.official) return 'finished';
  if (T.matches.some((m) => m.status !== 'scheduled')) return 'live';
  return 'upcoming';
}

export const STATUS_LABELS = { upcoming: 'Tournoi à venir', live: 'Tournoi en cours', finished: 'Tournoi terminé' };

export function matchTitle(m) {
  if (m.phase === 'group') return `Groupe ${m.grp} · Journée ${m.round}`;
  if (m.phase === 'qf') return `Quart de finale ${String(m.code).replace('QF', '')}`;
  if (m.phase === 'sf') return `Demi-finale ${String(m.code).replace('DF', '')}`;
  if (m.phase === 'fifth') return 'Match pour la 5e place';
  return PHASE_LABELS[m.phase] || m.code;
}

export function sideName(m, side) {
  const t = side === 'home' ? m.home : m.away;
  if (t) return t.name;
  return slotLabel(side === 'home' ? m.home_src : m.away_src);
}
