import Link from 'next/link';
import { loadT } from '@/lib/page.js';
import { GROUPS } from '@/lib/engine.js';
import { TeamBadge } from '@/components/ui.js';

export const metadata = { title: 'Équipes', description: 'Les 16 équipes du tournoi, leurs effectifs et leurs résultats.' };

export default async function Equipes() {
  const T = await loadT();
  const others = T.teams.filter((t) => !GROUPS.includes(t.grp));
  return (
    <div className="wrap">
      <h1 className="h1">Équipes</h1>
      {GROUPS.map((g) => (
        <section className="sec" key={g}>
          <h2 className="h2">Groupe {g}</h2>
          <div className="grid-teams">
            {T.teams.filter((t) => t.grp === g).map((t) => (
              <Link key={t.id} href={`/equipes/${t.id}`} className="card pad stack" style={{ color: 'inherit', alignItems: 'center', textAlign: 'center' }}>
                <TeamBadge team={t} size={64} />
                <b>{t.name}</b>
                <span className="small muted">{T.players.filter((p) => p.team_id === t.id).length} joueurs</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {others.length ? (
        <section className="sec">
          <h2 className="h2">Sans groupe</h2>
          <div className="grid-teams">
            {others.map((t) => <Link key={t.id} href={`/equipes/${t.id}`} className="card pad row" style={{ color: 'inherit' }}><TeamBadge team={t} size={36} /><b>{t.name}</b></Link>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
