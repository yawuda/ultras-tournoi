import Link from 'next/link';
import { loadT } from '@/lib/page.js';
import { playerStats, POSITION_LABELS } from '@/lib/engine.js';
import { fullName, rosterName } from '@/lib/format.js';
import { Avatar } from '@/components/ui.js';

export const metadata = { title: 'Joueurs', description: 'Tous les joueurs inscrits au tournoi et leurs statistiques.' };

export default async function Joueurs({ searchParams }) {
  const sp = await searchParams;
  const T = await loadT();
  const stats = playerStats(T);
  const teamId = Number(sp.equipe) || 0;
  const pos = sp.poste || '';
  const qv = String(sp.q || '').trim().toLowerCase();
  const list = T.players.filter((p) => (!teamId || p.team_id === teamId) && (!pos || p.position === pos) && (!qv || fullName(p).toLowerCase().includes(qv)));
  return (
    <div className="wrap">
      <h1 className="h1">Joueurs</h1>
      <form className="filters" method="get">
        <input type="search" name="q" defaultValue={sp.q || ''} placeholder="Rechercher un joueur" aria-label="Rechercher un joueur" />
        <select name="equipe" defaultValue={teamId || ''} aria-label="Équipe">
          <option value="">Toutes les équipes</option>
          {T.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="poste" defaultValue={pos} aria-label="Poste">
          <option value="">Tous les postes</option>
          {Object.entries(POSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn primary" type="submit">Filtrer</button>
      </form>
      <p className="small muted" style={{ margin: '12px 0 8px' }}>{list.length} joueur{list.length > 1 ? 's' : ''}</p>
      <div className="card table-box" style={{ padding: '4px 12px' }}>
        <table className="t">
          <thead><tr><th className="l">Joueur</th><th>N°</th><th className="l">Équipe</th><th className="l">Poste</th><th title="Matchs joués">MJ</th><th title="Buts">B</th><th title="Passes décisives">PD</th><th title="Cartons jaunes">CJ</th><th title="Cartons rouges">CR</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const s = stats.get(p.id);
              return (
                <tr key={p.id}>
                  <td className="l team"><Link href={`/joueurs/${p.id}`}><Avatar player={p} size={30} />{rosterName(p)}</Link></td>
                  <td><b>{p.number}</b></td>
                  <td className="l">{T.teamById.get(p.team_id)?.name}</td>
                  <td className="l">{POSITION_LABELS[p.position] || ''}</td>
                  <td>{s.mj}</td><td>{s.goals}</td><td>{s.assists}</td><td>{s.yellow}</td><td>{s.red}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
