import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadT } from '@/lib/page.js';
import { matchTitle, sideName } from '@/lib/engine.js';
import { fmtDayLong, fmtTime, shortName } from '@/lib/format.js';
import { TeamBadge, StatusChip, ScoreMid, EventIcon, eventText } from '@/components/ui.js';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const T = await loadT();
  const m = T.matchById.get(Number(id));
  if (!m) return { title: 'Match' };
  return { title: `${sideName(m, 'home')} – ${sideName(m, 'away')}`, description: `${matchTitle(m)} : score, buteurs, passeurs et cartons.` };
}

// Seuls les buts (avec passeur) et les cartons sont affichés au public.
const SHOWN = ['goal', 'own_goal', 'yellow', 'red'];

function scorersLine(T, m, teamId) {
  const by = new Map();
  for (const e of m.events) {
    let side = null;
    if (e.type === 'goal') side = e.team_id;
    else if (e.type === 'own_goal') side = e.team_id === m.home_id ? m.away_id : m.home_id;
    if (side !== teamId) continue;
    const p = T.playerById.get(e.player_id);
    const name = p ? shortName(p) + (e.type === 'own_goal' ? ' (csc)' : '') : 'But';
    if (!by.has(name)) by.set(name, []);
    by.get(name).push(`${e.minute}'`);
  }
  return [...by.entries()].map(([n, mins]) => `${n} ${mins.join(', ')}`).join(' · ');
}

function TeamFacts({ m, team }) {
  if (!team) return null;
  const ev = m.events.filter((e) => e.team_id === team.id);
  const goals = team.id === m.home_id ? m.hs : m.as;
  const assists = ev.filter((e) => e.type === 'goal' && e.assist_id).length;
  return (
    <div className="card pad stack" style={{ gap: 8 }}>
      <div className="row"><TeamBadge team={team} size={26} /><b>{team.name}</b></div>
      <div className="row between small"><span>Buts</span><b>{goals}</b></div>
      <div className="row between small"><span>Passes décisives</span><b>{assists}</b></div>
      <div className="row between small"><span>Cartons jaunes</span><b>{ev.filter((e) => e.type === 'yellow').length}</b></div>
      <div className="row between small"><span>Cartons rouges</span><b>{ev.filter((e) => e.type === 'red').length}</b></div>
    </div>
  );
}

export default async function MatchPage({ params }) {
  const { id } = await params;
  const T = await loadT();
  const m = T.matchById.get(Number(id));
  if (!m) notFound();
  const events = m.events.filter((e) => SHOWN.includes(e.type)).reverse();
  const hl = m.home ? scorersLine(T, m, m.home.id) : '';
  const al = m.away ? scorersLine(T, m, m.away.id) : '';
  return (
    <>
      <section className="hero">
        <div className="wrap" style={{ paddingTop: 14, paddingBottom: 22, gap: 14 }}>
          <div className="row between wrapx">
            <Link href="/matchs" style={{ fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>‹ Tous les matchs</Link>
            <StatusChip m={m} settings={T.settings} />
          </div>
          <p style={{ textAlign: 'center', color: '#d5dae3' }}>{matchTitle(m)}</p>
          <div className="match-main">
            <div className="side" style={{ flexDirection: 'column', textAlign: 'center' }}>
              <TeamBadge team={m.home} size={68} />
              {m.home ? <Link href={`/equipes/${m.home.id}`} style={{ color: '#fff' }}>{m.home.name}</Link> : <span>{sideName(m, 'home')}</span>}
            </div>
            <ScoreMid m={m} big />
            <div className="side" style={{ flexDirection: 'column', textAlign: 'center' }}>
              <TeamBadge team={m.away} size={68} />
              {m.away ? <Link href={`/equipes/${m.away.id}`} style={{ color: '#fff' }}>{m.away.name}</Link> : <span>{sideName(m, 'away')}</span>}
            </div>
          </div>
          {hl || al ? (
            <div className="scorers-line"><div>{hl}</div><div>{al}</div></div>
          ) : null}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#b8c2d0' }}>
            {fmtDayLong(m.kickoff)} · Coup d'envoi {fmtTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ''}
            {m.started_at ? ` · Début ${m.started_at}` : ''}{m.ended_at ? ` · Fin ${m.ended_at}` : ''}
          </p>
          {m.status === 'finished' && !m.validated ? <p style={{ textAlign: 'center', fontSize: 13, color: '#d5dae3' }}>Résultat provisoire, en attente de validation officielle.</p> : null}
        </div>
      </section>
      <div className="wrap">
        <section className="sec">
          <h2 className="h2">Faits du match</h2>
          <div className="card">
            {events.length === 0 ? <p className="pad muted">{m.status === 'scheduled' ? "Le match n'a pas encore commencé." : 'Aucun but ni carton pour le moment.'}</p> : null}
            {events.map((e) => {
              const t = eventText(e, T);
              return (
                <div className="tl" key={e.id}>
                  <span className="min">{e.minute}'</span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}><EventIcon type={e.type} /></span>
                  <span><b style={{ display: 'block' }}>{t.title}</b>{t.sub ? <span className="small muted">{t.sub}</span> : null}</span>
                  <TeamBadge team={T.teamById.get(e.team_id)} size={24} />
                </div>
              );
            })}
          </div>
        </section>
        {m.status !== 'scheduled' ? (
          <section className="sec">
            <div className="grid2">
              <TeamFacts m={m} team={m.home} />
              <TeamFacts m={m} team={m.away} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
