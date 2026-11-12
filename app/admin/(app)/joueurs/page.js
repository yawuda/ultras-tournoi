import Link from 'next/link';
import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { POSITION_LABELS } from '@/lib/engine.js';
import { rosterName } from '@/lib/format.js';
import { Flash, Avatar } from '@/components/ui.js';
import PlayerForm from '@/components/PlayerForm.js';

export default async function AdminPlayers({ searchParams }) {
  const sp = await searchParams;
  await requireUser(['superadmin', 'admin']);
  const T = await loadFresh();
  const teamId = Number(sp.equipe) || 0;
  const list = T.players.filter((p) => !teamId || p.team_id === teamId);
  return (
    <>
      <h1 className="h1">Joueurs</h1>
      <Flash sp={sp} />
      <form className="filters" method="get">
        <select name="equipe" defaultValue={teamId || ''} aria-label="Équipe">
          <option value="">Toutes les équipes ({T.players.length} joueurs)</option>
          {T.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn primary" type="submit">Filtrer</button>
      </form>
      <section className="sec">
        <h2 className="h2">Ajouter un joueur</h2>
        <div className="card pad"><PlayerForm player={null} teams={T.teams} teamId={teamId || T.teams[0]?.id} back={`/admin/joueurs${teamId ? `?equipe=${teamId}` : ''}`} /></div>
      </section>
      <section className="sec">
        <div className="card table-box" style={{ padding: '4px 12px' }}>
          <table className="t">
            <thead><tr><th>N°</th><th className="l">Joueur</th><th className="l">Équipe</th><th className="l">Poste</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.number}</b></td>
                  <td className="l team"><span className="row"><Avatar player={p} size={28} />{rosterName(p)}</span></td>
                  <td className="l">{T.teamById.get(p.team_id)?.name}</td>
                  <td className="l">{POSITION_LABELS[p.position]}</td>
                  <td><Link className="btn sm" href={`/admin/equipes/${p.team_id}`}>Modifier</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
