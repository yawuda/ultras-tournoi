import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadT } from '@/lib/page.js';
import { playerStats, POSITION_LABELS, matchTitle, sideName } from '@/lib/engine.js';
import { fullName, fmtDay } from '@/lib/format.js';
import { Avatar, TeamBadge, EventIcon } from '@/components/ui.js';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const T = await loadT();
  const p = T.playerById.get(Number(id));
  return { title: p ? fullName(p) : 'Joueur' };
}

export default async function PlayerPage({ params }) {
  const { id } = await params;
  const T = await loadT();
  const p = T.playerById.get(Number(id));
  if (!p) notFound();
  const team = T.teamById.get(p.team_id);
  const s = playerStats(T).get(p.id);
  const log = [];
  for (const m of T.matches) {
    for (const e of m.events) {
      if (e.player_id === p.id && e.type !== 'sub') log.push({ m, e, label: { goal: 'But', own_goal: 'But contre son camp', yellow: 'Carton jaune', red: 'Carton rouge' }[e.type] });
      else if (e.assist_id === p.id) log.push({ m, e, label: 'Passe décisive' });
    }
  }
  return (
    <div className="wrap">
      <div className="row" style={{ margin: '20px 0 6px', gap: 14 }}>
        <Avatar player={p} size={88} />
        <div>
          <h1 className="h1" style={{ margin: 0 }}>{fullName(p)}</h1>
          <p className="muted row wrapx">
            <span>{[p.number != null ? `N° ${p.number}` : null, POSITION_LABELS[p.position], p.is_captain ? 'Capitaine' : null].filter(Boolean).join(' · ')}</span>
            {team ? <Link href={`/equipes/${team.id}`} className="row"><TeamBadge team={team} size={22} />{team.name}</Link> : null}
          </p>
        </div>
      </div>
      <section className="sec">
        <div className="grid2">
          <div className="card tile"><b>{s.mj}</b><span>matchs joués</span></div>
          <div className="card tile"><b>{s.goals}</b><span>buts</span></div>
          <div className="card tile"><b>{s.assists}</b><span>passes décisives</span></div>
          <div className="card tile"><b>{s.yellow} / {s.red}</b><span>cartons jaunes / rouges</span></div>
        </div>
      </section>
      <section className="sec">
        <h2 className="h2">Match par match</h2>
        <div className="card">
          {log.length === 0 ? <p className="pad muted">Aucune action enregistrée pour le moment.</p> : null}
          {log.map(({ m, e, label }) => (
            <Link key={`${e.id}-${label}`} href={`/matchs/${m.id}`} className="tl">
              <span className="min">{e.minute}'</span>
              <span style={{ display: 'flex', justifyContent: 'center' }}><EventIcon type={label === 'Passe décisive' ? 'goal' : e.type} /></span>
              <span><b style={{ display: 'block' }}>{label}</b><span className="small muted">{sideName(m, 'home')} – {sideName(m, 'away')} · {matchTitle(m)} · {fmtDay(m.kickoff)}</span></span>
              <span className="chip">{m.hs} – {m.as}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
