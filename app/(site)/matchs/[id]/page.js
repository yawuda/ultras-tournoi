import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadT } from '@/lib/page.js';
import { matchTitle, sideName, suspensions } from '@/lib/engine.js';
import { fmtDayLong, fmtTime, fullName } from '@/lib/format.js';
import { TeamBadge, StatusChip, ScoreMid, EventIcon, eventText } from '@/components/ui.js';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const T = await loadT();
  const m = T.matchById.get(Number(id));
  if (!m) return { title: 'Match' };
  return { title: `${sideName(m, 'home')} – ${sideName(m, 'away')}`, description: `${matchTitle(m)} : score, buteurs, cartons et compositions.` };
}

function Squad({ T, m, team, suspended }) {
  if (!team) return null;
  const rows = m.lineup.filter((l) => l.team_id === team.id).map((l) => ({ ...l, p: T.playerById.get(l.player_id) })).filter((l) => l.p);
  rows.sort((a, b) => (a.p.number || 0) - (b.p.number || 0));
  const st = rows.filter((l) => l.starter);
  const sb = rows.filter((l) => !l.starter);
  const sus = T.players.filter((p) => p.team_id === team.id && suspended.has(p.id));
  return (
    <div className="card pad">
      <div className="row" style={{ marginBottom: 8 }}><TeamBadge team={team} size={28} /><b>{team.name}</b></div>
      {rows.length === 0 ? <p className="small muted">Composition non renseignée.</p> : null}
      {st.length ? <p className="step-l" style={{ color: 'var(--blue)', padding: '6px 0' }}>Titulaires ({st.length})</p> : null}
      {st.map((l) => <Link key={l.player_id} href={`/joueurs/${l.player_id}`} className="lineup-row" style={{ color: 'inherit' }}><span><b className="muted" style={{ display: 'inline-block', width: 26 }}>{l.p.number}</b>{fullName(l.p)}</span></Link>)}
      {sb.length ? <p className="step-l" style={{ padding: '10px 0 6px' }}>Remplaçants ({sb.length})</p> : null}
      {sb.map((l) => <Link key={l.player_id} href={`/joueurs/${l.player_id}`} className="lineup-row" style={{ color: 'var(--text2)' }}><span><b className="muted" style={{ display: 'inline-block', width: 26 }}>{l.p.number}</b>{fullName(l.p)}</span></Link>)}
      {sus.length ? <p className="small" style={{ color: 'var(--red)', paddingTop: 10 }}>Suspendu{sus.length > 1 ? 's' : ''} : {sus.map(fullName).join(', ')}</p> : null}
    </div>
  );
}

export default async function MatchPage({ params }) {
  const { id } = await params;
  const T = await loadT();
  const m = T.matchById.get(Number(id));
  if (!m) notFound();
  const suspended = suspensions(T).byMatch.get(m.id) || new Set();
  const events = [...m.events].reverse();
  return (
    <>
      <section className="hero plain">
        <div className="wrap" style={{ paddingTop: 22, paddingBottom: 22, gap: 14 }}>
          <div className="row between wrapx">
            <Link href="/matchs" style={{ color: '#d5dae3', fontWeight: 600 }}>‹ Tous les matchs</Link>
            <StatusChip m={m} settings={T.settings} />
          </div>
          <p style={{ textAlign: 'center' }}>{matchTitle(m)}</p>
          <div className="match-main">
            <div className="side" style={{ flexDirection: 'column', color: '#fff', textAlign: 'center' }}>
              <TeamBadge team={m.home} size={64} />
              {m.home ? <Link href={`/equipes/${m.home.id}`} style={{ color: '#fff' }}>{m.home.name}</Link> : <span>{sideName(m, 'home')}</span>}
            </div>
            <ScoreMid m={m} big />
            <div className="side" style={{ flexDirection: 'column', color: '#fff', textAlign: 'center' }}>
              <TeamBadge team={m.away} size={64} />
              {m.away ? <Link href={`/equipes/${m.away.id}`} style={{ color: '#fff' }}>{m.away.name}</Link> : <span>{sideName(m, 'away')}</span>}
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13 }}>
            {fmtDayLong(m.kickoff)} · {fmtTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ''}
            {m.started_at ? ` · Début ${m.started_at}` : ''}{m.ended_at ? ` · Fin ${m.ended_at}` : ''}
          </p>
          {m.status === 'finished' && !m.validated ? <p style={{ textAlign: 'center', fontSize: 13 }}>Résultat provisoire, en attente de validation officielle.</p> : null}
        </div>
      </section>
      <div className="wrap">
        <section className="sec">
          <h2 className="h2">Chronologie</h2>
          <div className="card">
            {events.length === 0 ? <p className="pad muted">{m.status === 'scheduled' ? "Le match n'a pas encore commencé." : 'Aucun événement enregistré.'}</p> : null}
            {events.map((e) => {
              const t = eventText(e, T);
              return (
                <div className="tl" key={e.id}>
                  <span className="min">{e.minute}'</span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}><EventIcon type={e.type} /></span>
                  <span><b style={{ display: 'block' }}>{t.title}</b>{t.sub ? <span className="small muted">{t.sub}</span> : null}</span>
                  <span className="chip">{T.teamById.get(e.team_id)?.short}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="sec">
          <h2 className="h2">Compositions</h2>
          <div className="grid-auto">
            <Squad T={T} m={m} team={m.home} suspended={suspended} />
            <Squad T={T} m={m} team={m.away} suspended={suspended} />
          </div>
        </section>
      </div>
    </>
  );
}
