import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { POSITION_LABELS } from '@/lib/engine.js';
import { fullName } from '@/lib/format.js';
import { Flash, TeamBadge, Avatar } from '@/components/ui.js';
import TeamForm from '@/components/TeamForm.js';
import PlayerForm from '@/components/PlayerForm.js';
import { deleteTeamAction, deletePlayerAction } from '../../../actions.js';

export default async function AdminTeam({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(['superadmin', 'admin']);
  const T = await loadFresh();
  const team = T.teamById.get(Number(id));
  if (!team) notFound();
  const squad = T.players.filter((p) => p.team_id === team.id);
  const back = `/admin/equipes/${team.id}`;
  return (
    <>
      <p style={{ marginTop: 14 }}><Link href="/admin/equipes">‹ Toutes les équipes</Link></p>
      <div className="row" style={{ margin: '8px 0 14px' }}><TeamBadge team={team} size={56} /><h1 className="h1" style={{ margin: 0 }}>{team.name}</h1></div>
      <Flash sp={sp} />
      <section className="sec">
        <h2 className="h2">Informations</h2>
        <TeamForm team={team} />
      </section>
      <section className="sec">
        <h2 className="h2">Effectif ({squad.length})</h2>
        <div className="stack">
          {squad.map((p) => (
            <details key={p.id} className="card">
              <summary className="row" style={{ display: 'flex' }}>
                <Avatar player={p} size={32} />
                <span><b>{p.number}</b> · {fullName(p)} <span className="muted small">· {POSITION_LABELS[p.position]}</span></span>
              </summary>
              <div className="pad stack">
                <PlayerForm player={p} teams={T.teams} back={back} />
                <form action={deletePlayerAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className="btn sm danger" type="submit">Supprimer ce joueur</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      </section>
      <section className="sec">
        <h2 className="h2">Ajouter un joueur</h2>
        <div className="card pad"><PlayerForm player={null} teams={T.teams} teamId={team.id} back={back} /></div>
      </section>
      <section className="sec">
        <form action={deleteTeamAction}>
          <input type="hidden" name="id" value={team.id} />
          <details className="card">
            <summary>Supprimer l'équipe</summary>
            <div className="pad stack">
              <p className="small muted">Possible uniquement si l'équipe n'a joué aucun match. Ses joueurs seront supprimés.</p>
              <button className="btn danger" type="submit">Confirmer la suppression</button>
            </div>
          </details>
        </form>
      </section>
    </>
  );
}
