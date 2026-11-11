'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { liveMinute, liveLabel, PERIOD_LABELS } from '@/lib/engine.js';
import { liveAddEvent, liveUpdateEvent, liveDeleteEvent, liveStart, livePeriod, livePens, liveFinish, liveValidate, liveUnvalidate, liveLineup } from '@/app/admin/actions.js';
const A = { liveAddEvent, liveUpdateEvent, liveDeleteEvent, liveStart, livePeriod, livePens, liveFinish, liveValidate, liveUnvalidate, liveLineup };

const TYPES = [
  ['goal', 'But'],
  ['yellow', 'Carton jaune'],
  ['red', 'Carton rouge'],
  ['sub', 'Remplacement'],
  ['own_goal', 'Contre son camp'],
];
const TYPE_LABEL = Object.fromEntries(TYPES);

function short(p) {
  if (!p) return '—';
  return p.first_name ? `${p.first_name[0]}. ${p.last_name}` : p.last_name;
}

function Icon({ type }) {
  if (type === 'yellow') return <span className="cardico y" aria-hidden="true" />;
  if (type === 'red') return <span className="cardico r" aria-hidden="true" />;
  if (type === 'sub')
    return (
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4" />
      </svg>
    );
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8l4 3-1.5 4.5h-5L8 11z" />
    </svg>
  );
}

export default function LiveConsole({ match: m, home, away, players, events, lineup, settings, role, suspended }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [teamId, setTeamId] = useState(m.home_id);
  const [type, setType] = useState('goal');
  const [playerId, setPlayerId] = useState(null);
  const [assistId, setAssistId] = useState(null);
  const [inId, setInId] = useState(null);
  const [minute, setMinute] = useState(null); // null = minute automatique
  const [editId, setEditId] = useState(null);
  const [pens, setPens] = useState([m.home_pens ?? '', m.away_pens ?? '']);
  const [showLineup, setShowLineup] = useState(false);
  const isAdmin = role !== 'manager';

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    const r = setInterval(() => {
      if (document.visibilityState === 'visible' && !editId) router.refresh();
    }, 20000);
    return () => {
      clearInterval(id);
      clearInterval(r);
    };
  }, [router, editId]);

  const autoMin = liveMinute(m, settings, now);
  const shownMin = minute ?? autoMin ?? 1;
  const squad = useMemo(() => {
    const role = new Map(lineup.map((l) => [l.player_id, l.starter]));
    return players
      .filter((p) => p.team_id === teamId)
      .map((p) => ({ ...p, starter: role.get(p.id) }))
      .sort((a, b) => (a.starter === b.starter ? (a.number || 0) - (b.number || 0) : a.starter === true ? -1 : b.starter === true ? 1 : a.starter === false ? -1 : 1));
  }, [players, lineup, teamId]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const teamName = (id) => (id === m.home_id ? home?.name : away?.name);

  function run(fn, ok) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setMsg({ err: true, text: res.error });
      else {
        if (ok) setMsg({ err: false, text: ok });
        router.refresh();
      }
    });
  }
  function resetForm() {
    setPlayerId(null);
    setAssistId(null);
    setInId(null);
    setMinute(null);
    setEditId(null);
  }
  function submit() {
    const d = { match_id: m.id, team_id: teamId, type, player_id: playerId, assist_id: type === 'goal' ? assistId : null, player_in_id: type === 'sub' ? inId : null, minute: minute ?? autoMin ?? 1 };
    if (editId) run(() => A.liveUpdateEvent({ ...d, id: editId }), 'Événement corrigé.');
    else run(() => A.liveAddEvent(d), `${TYPE_LABEL[type]} enregistré.`);
    resetForm();
  }
  function edit(e) {
    setEditId(e.id);
    setTeamId(e.team_id);
    setType(e.type);
    setPlayerId(e.player_id);
    setAssistId(e.assist_id);
    setInId(e.player_in_id);
    setMinute(e.minute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function choosePlayer(id) {
    setPlayerId(playerId === id ? null : id);
    if (assistId === id) setAssistId(null);
  }

  const canEdit = m.status === 'live' || (m.status === 'finished' && !m.validated && isAdmin);
  const hs = m.hs;
  const as = m.as;
  const tied = hs === as;
  const ko = m.phase !== 'group';
  const playerLabel = type === 'sub' ? 'Joueur sortant' : type === 'goal' ? 'Buteur (facultatif)' : type === 'own_goal' ? 'Joueur (facultatif)' : 'Joueur';
  const scoreAfter = () => {
    if (editId) return '';
    if (type === 'goal') return teamId === m.home_id ? ` · ${hs + 1} – ${as}` : ` · ${hs} – ${as + 1}`;
    if (type === 'own_goal') return teamId === m.home_id ? ` · ${hs} – ${as + 1}` : ` · ${hs + 1} – ${as}`;
    return '';
  };
  const needPlayer = (type === 'yellow' || type === 'red' || type === 'sub') && !playerId;
  const needIn = type === 'sub' && !inId;

  // Boutons de déroulement du match
  const flow = [];
  if (m.status === 'scheduled') flow.push(['start', 'Démarrer le match', 'primary']);
  if (m.status === 'live') {
    const p = m.period;
    if (p === '1H') flow.push(['HT', 'Mi-temps', '']);
    if (p === 'HT') flow.push(['2H', 'Début 2e mi-temps', 'primary']);
    if (p === '2H' && ko && tied) flow.push(['FT', 'Fin du temps réglementaire', '']);
    if (p === 'FT') flow.push(['ET1', 'Début prolongation', 'primary']);
    if (p === 'ET1') flow.push(['ETB', 'Pause prolongation', '']);
    if (p === 'ETB') flow.push(['ET2', '2e période de prolongation', 'primary']);
    if (p === 'ET2' && tied) flow.push(['PEN', 'Tirs au but', 'primary']);
    if (!ko || !tied || p === 'PEN') flow.push(['finish', 'Terminer le match', 'dark']);
  }
  function doFlow(k) {
    if (k === 'start') return run(() => A.liveStart(m.id), 'Match démarré.');
    if (k === 'finish') {
      if (!window.confirm(`Terminer le match sur le score de ${hs} – ${as} ?`)) return;
      return run(() => A.liveFinish(m.id), isAdmin ? 'Match terminé : validez le résultat pour mettre à jour le classement.' : 'Match terminé. Un administrateur va valider le résultat.');
    }
    return run(() => A.livePeriod(m.id, k));
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="scorebar">
        <div className="side" style={{ flexDirection: 'column', textAlign: 'center' }}>
          <span>{home?.name || '?'}</span>
        </div>
        <div className="mid">
          <span className="score big" style={{ fontSize: 52 }}>{hs} – {as}</span>
          {m.home_pens != null && m.away_pens != null ? <span className="small">t.a.b. {m.home_pens} – {m.away_pens}</span> : null}
          <span className="minute">{m.status === 'live' ? liveLabel(m, settings, now) : m.status === 'finished' ? (m.validated ? 'Résultat validé' : 'Terminé · brouillon') : 'Avant-match'}</span>
        </div>
        <div className="side" style={{ flexDirection: 'column', textAlign: 'center' }}>
          <span>{away?.name || '?'}</span>
        </div>
      </div>

      {msg ? <p className={msg.err ? 'flash err' : 'flash ok'} role={msg.err ? 'alert' : 'status'} style={{ margin: 0 }}>{msg.text}</p> : null}

      {flow.length ? (
        <div className="seg">
          {flow.map(([k, label, cls]) => (
            <button key={k} className={`btn lg ${cls}`} disabled={pending} onClick={() => doFlow(k)} style={flow.length === 1 ? { gridColumn: '1 / -1' } : undefined}>{label}</button>
          ))}
        </div>
      ) : null}
      {m.status === 'live' ? <p className="small muted" style={{ marginTop: -8 }}>Période : {PERIOD_LABELS[m.period] || '—'}. {ko ? `En cas d'égalité : prolongation 2 × ${settings.et_minutes || 10} min puis tirs au but.` : ''}</p> : null}

      {m.status === 'live' && m.period === 'PEN' ? (
        <div className="card pad stack">
          <span className="step-l">Tirs au but</span>
          <div className="seg">
            <label className="f">{home?.name}<input className="in" type="number" min="0" inputMode="numeric" value={pens[0]} onChange={(e) => setPens([e.target.value, pens[1]])} /></label>
            <label className="f">{away?.name}<input className="in" type="number" min="0" inputMode="numeric" value={pens[1]} onChange={(e) => setPens([pens[0], e.target.value])} /></label>
          </div>
          <button className="btn primary" disabled={pending} onClick={() => run(() => A.livePens(m.id, pens[0], pens[1]), 'Tirs au but enregistrés.')}>Enregistrer les tirs au but</button>
        </div>
      ) : null}

      {m.status === 'finished' && isAdmin ? (
        m.validated ? (
          <div className="card pad stack">
            <p className="small muted">Résultat officiel : il compte dans le classement. Pour corriger un événement, dévalidez d'abord le résultat.</p>
            <button className="btn danger" disabled={pending} onClick={() => run(() => A.liveUnvalidate(m.id), 'Résultat repassé en brouillon : vous pouvez corriger.')}>Dévalider pour corriger</button>
          </div>
        ) : (
          <button className="btn primary lg" disabled={pending} onClick={() => run(() => A.liveValidate(m.id), 'Résultat validé : classement et qualifications mis à jour.')}>Valider officiellement le résultat ({hs} – {as})</button>
        )
      ) : null}
      {m.status === 'finished' && !isAdmin && !m.validated ? <p className="card pad small muted">Match terminé. Le résultat sera validé par un administrateur.</p> : null}

      {canEdit ? (
        <div className="card pad stack" style={{ gap: 16 }}>
          {editId ? (
            <div className="row between"><b>Correction d'un événement</b><button className="btn sm" onClick={resetForm}>Annuler la correction</button></div>
          ) : null}
          <div className="stack" style={{ gap: 8 }}>
            <span className="step-l">1 · Équipe</span>
            <div className="seg">
              {[home, away].map((t) => t && (
                <button key={t.id} className={teamId === t.id ? 'pick on' : 'pick'} aria-pressed={teamId === t.id} onClick={() => { setTeamId(t.id); setPlayerId(null); setAssistId(null); setInId(null); }}>{t.name}</button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="step-l">2 · Événement</span>
            <div className="seg">
              {TYPES.map(([k, label]) => (
                <button key={k} className={type === k ? 'pick tall on blue' : 'pick tall'} aria-pressed={type === k} onClick={() => { setType(k); setAssistId(null); setInId(null); }}>
                  <Icon type={k} />{label}
                </button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="row between"><span className="step-l">3 · {playerLabel}</span><b className="small">{playerId ? `${byId.get(playerId)?.number != null ? `n° ${byId.get(playerId).number} · ` : ''}${short(byId.get(playerId))}` : ''}</b></div>
            <div className="pgrid">
              {squad.map((p) => (
                <button key={p.id} className={`pnum${playerId === p.id ? ' on' : ''}${p.starter === undefined && lineup.length ? ' off' : ''}${suspended.includes(p.id) ? ' sus' : ''}`} aria-pressed={playerId === p.id} aria-label={`${p.number != null ? `Numéro ${p.number}, ` : ''}${p.first_name || ''} ${p.last_name}`} onClick={() => choosePlayer(p.id)}>
                  {p.number != null ? <><b>{p.number}</b><small>{p.last_name}</small></> : <><b style={{ fontSize: 14, fontFamily: 'inherit', fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.last_name}</b><small>{p.first_name || ''}</small></>}
                </button>
              ))}
            </div>
            {lineup.length ? <p className="small muted">Titulaires en premier, puis remplaçants. Grisés : non inscrits sur la feuille de match.</p> : null}
          </div>
          {type === 'goal' ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row between"><span className="step-l">4 · Passeur décisif (facultatif)</span><b className="small">{assistId ? short(byId.get(assistId)) : ''}</b></div>
              <div className="pgrid">
                {squad.filter((p) => p.id !== playerId).map((p) => (
                  <button key={p.id} className={assistId === p.id ? 'pnum on' : 'pnum'} aria-pressed={assistId === p.id} aria-label={`Passeur : ${p.first_name || ""} ${p.last_name}`} onClick={() => setAssistId(assistId === p.id ? null : p.id)}>
                    {p.number != null ? <><b>{p.number}</b><small>{p.last_name}</small></> : <><b style={{ fontSize: 14, fontFamily: 'inherit', fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.last_name}</b><small>{p.first_name || ''}</small></>}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {type === 'sub' ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row between"><span className="step-l">4 · Joueur entrant</span><b className="small">{inId ? short(byId.get(inId)) : ''}</b></div>
              <div className="pgrid">
                {squad.filter((p) => p.id !== playerId).map((p) => (
                  <button key={p.id} className={inId === p.id ? 'pnum on' : 'pnum'} aria-pressed={inId === p.id} aria-label={`Entrant : ${p.first_name || ""} ${p.last_name}`} onClick={() => setInId(inId === p.id ? null : p.id)}>
                    {p.number != null ? <><b>{p.number}</b><small>{p.last_name}</small></> : <><b style={{ fontSize: 14, fontFamily: 'inherit', fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.last_name}</b><small>{p.first_name || ''}</small></>}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="row between wrapx">
            <span className="step-l">Minute {minute === null && autoMin ? '(automatique)' : ''}</span>
            <div className="row" style={{ border: '2px solid var(--line)', borderRadius: 12 }}>
              <button className="btn sm" style={{ border: 0, fontSize: 22 }} aria-label="Minute précédente" onClick={() => setMinute(Math.max(1, shownMin - 1))}>−</button>
              <b style={{ fontFamily: 'var(--disp)', fontSize: 26, minWidth: 48, textAlign: 'center' }}>{shownMin}'</b>
              <button className="btn sm" style={{ border: 0, fontSize: 22 }} aria-label="Minute suivante" onClick={() => setMinute(Math.min(130, shownMin + 1))}>+</button>
            </div>
          </div>
          <button className="btn primary lg" disabled={pending || needPlayer || needIn} onClick={submit}>
            {editId ? 'Enregistrer la correction' : `Enregistrer : ${TYPE_LABEL[type].toLowerCase()}${scoreAfter()}`}
          </button>
          {needPlayer ? <p className="small muted" style={{ marginTop: -8 }}>Sélectionnez {type === 'sub' ? 'le joueur sortant' : 'le joueur'}.</p> : needIn ? <p className="small muted" style={{ marginTop: -8 }}>Sélectionnez le joueur entrant.</p> : null}
        </div>
      ) : null}

      <div className="stack" style={{ gap: 8 }}>
        <span className="step-l">Événements du match ({events.length})</span>
        <div className="card" style={{ padding: '2px 12px' }}>
          {events.length === 0 ? <p className="small muted" style={{ padding: '10px 0' }}>Aucun événement.</p> : null}
          {[...events].reverse().map((e) => (
            <div className="ev" key={e.id}>
              <span className="min">{e.minute}'</span>
              <span className="row" style={{ gap: 6, minWidth: 0 }}>
                <Icon type={e.type} />
                <span style={{ minWidth: 0 }}>
                  <b>{TYPE_LABEL[e.type]}</b> · {e.type === 'sub' ? `${short(byId.get(e.player_in_id))} ↔ ${short(byId.get(e.player_id))}` : e.player_id ? short(byId.get(e.player_id)) : 'buteur non précisé'}
                  {e.assist_id ? <span className="muted"> (passe {short(byId.get(e.assist_id))})</span> : null}
                  <span className="muted"> · {teamName(e.team_id)}</span>
                </span>
              </span>
              {canEdit ? <button className="btn sm" disabled={pending} onClick={() => edit(e)}>Corriger</button> : <span />}
              {canEdit ? (
                <button className="btn sm danger" disabled={pending} onClick={() => { if (window.confirm('Annuler cet événement ?')) run(() => A.liveDeleteEvent(e.id), 'Événement annulé.'); }}>Annuler</button>
              ) : <span />}
            </div>
          ))}
        </div>
      </div>

      {!m.validated && m.home_id && m.away_id ? (
        <div className="card">
          <button className="btn block" style={{ border: 0, justifyContent: 'space-between' }} aria-expanded={showLineup} onClick={() => setShowLineup(!showLineup)}>
            Feuille de match (titulaires et remplaçants) <span>{showLineup ? '▲' : '▼'}</span>
          </button>
          {showLineup ? (
            <div className="grid-auto" style={{ padding: '0 12px 12px' }}>
              {[home, away].map((t) => <LineupEditor key={t.id} team={t} m={m} players={players} lineup={lineup} suspended={suspended} run={run} pending={pending} />)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LineupEditor({ team, m, players, lineup, suspended, run, pending }) {
  const squad = players.filter((p) => p.team_id === team.id);
  const initial = Object.fromEntries(squad.map((p) => {
    const l = lineup.find((x) => x.player_id === p.id);
    return [p.id, l ? (l.starter ? 'T' : 'R') : ''];
  }));
  const [sel, setSel] = useState(initial);
  const nT = Object.values(sel).filter((v) => v === 'T').length;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <b style={{ paddingTop: 8 }}>{team.name} <span className="small muted">({nT} titulaire{nT > 1 ? 's' : ''})</span></b>
      {squad.map((p) => (
        <label className="lineup-row" key={p.id}>
          <span><b className="muted" style={{ display: 'inline-block', width: 26 }}>{p.number}</b>{p.first_name} {p.last_name}{suspended.includes(p.id) ? <span className="chip" style={{ marginLeft: 6, color: 'var(--red)', borderColor: 'var(--red)' }}>Suspendu</span> : null}</span>
          <select value={sel[p.id]} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })} aria-label={`Statut de ${p.last_name}`}>
            <option value="">Absent</option>
            <option value="T">Titulaire</option>
            <option value="R">Remplaçant</option>
          </select>
        </label>
      ))}
      <div className="row" style={{ paddingTop: 6 }}>
        <button className="btn sm" onClick={() => setSel(Object.fromEntries(squad.map((p, i) => [p.id, suspended.includes(p.id) ? '' : i < 8 ? 'T' : 'R'])))}>8 premiers titulaires</button>
        <button
          className="btn sm primary"
          disabled={pending}
          onClick={() => run(() => A.liveLineup({
            match_id: m.id,
            team_id: team.id,
            starters: squad.filter((p) => sel[p.id] === 'T').map((p) => p.id),
            subs: squad.filter((p) => sel[p.id] === 'R').map((p) => p.id),
          }), `Feuille de match de ${team.name} enregistrée.`)}
        >
          Enregistrer
        </button>
      </div>
      {nT > 8 ? <p className="small" style={{ color: 'var(--red)' }}>Attention : plus de 8 titulaires.</p> : null}
    </div>
  );
}
