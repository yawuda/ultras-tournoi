import Link from 'next/link';
import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { Flash, TeamBadge } from '@/components/ui.js';
import TeamForm from '@/components/TeamForm.js';

export default async function AdminTeams({ searchParams }) {
  const sp = await searchParams;
  await requireUser(['superadmin', 'admin']);
  const T = await loadFresh();
  return (
    <>
      <h1 className="h1">Équipes</h1>
      <Flash sp={sp} />
      <div className="grid-teams">
        {T.teams.map((t) => (
          <Link key={t.id} href={`/admin/equipes/${t.id}`} className="card pad row" style={{ color: 'inherit' }}>
            <TeamBadge team={t} size={40} />
            <span><b style={{ display: 'block' }}>{t.name}</b><span className="small muted">Groupe {t.grp || '—'} · {T.players.filter((p) => p.team_id === t.id).length} joueurs</span></span>
          </Link>
        ))}
      </div>
      <section className="sec">
        <h2 className="h2">Ajouter une équipe</h2>
        <TeamForm team={null} />
      </section>
    </>
  );
}
