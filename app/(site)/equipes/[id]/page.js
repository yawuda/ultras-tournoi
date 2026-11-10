import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadT } from '@/lib/page.js';
import { groupStandings, teamRecord, playerStats, suspensions, POSITION_LABELS } from '@/lib/engine.js';
import { fullName } from '@/lib/format.js';
import { TeamBadge, MatchCard, Avatar } from '@/components/ui.js';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const T = await loadT();
  const t = T.teamById.get(Number(id));
  return { title: t ? t.name : 'Équipe', description: t ? `Effectif, matchs, résultats et statistiques de ${t.name}.` : undefined };
}

export default async function TeamPage({ params }) {
  const { id } = await params;
  const T = await loadT();
  const team = T.teamById.get(Number(id));
  if (!team) notFound();
  const rec = teamRecord(T, team.id);
  const row = team.grp ? groupStandings(T, team.grp).find((r) => r.team.id === team.id) : null;
  const stats = playerStats(T);
  const squad = T.players.filter((p) => p.team_id === team.id);
  const matches = T.matches.filter((m) => m.home_id === team.id || m.away_id === team.id);
  const sus = suspensions(T);
  const nextMatch = matches.find((m) => m.status === 'scheduled');
  const out = new Set([...(nextMatch ? sus.byMatch.get(nextMatch.id) || [] : []), ...(sus.pending.get(team.id) || [])]);
  return (
    <div className="wrap">
      <div className="row" style={{ margin: '20px 0 6px', gap: 14 }}>
        <TeamBadge team={team} size={72} />
        <div>
          <h1 className="h1" style={{ margin: 0 }}>{team.name}</h1>
          <p className="muted">
            {team.grp ? `Groupe ${team.grp}` : 'Sans groupe'}{row ? ` · ${row.pos}${row.pos === 1 ? 'er' : 'e'} avec ${row.pts} pts` : ''}
            {team.coach ? ` · Responsable : ${team.coach}` : ''}
          </p>
        </div>
      </div>
      <section className="sec">
        <h2 className="h2">Statistiques</h2>
        <div className="grid2">
          <div className="card tile"><b>{rec.v} / {rec.n} / {rec.d}</b><span>victoires / nuls / défaites ({rec.j} joués)</span></div>
          <div className="card tile"><b>{rec.bp} : {rec.bc}</b><span>buts marqués : encaissés</span></div>
          <div className="card tile"><b>{rec.bp - rec.bc > 0 ? '+' : ''}{rec.bp - rec.bc}</b><span>différence de buts</span></div>
          <div className="card tile"><b>{rec.yellow} / {rec.red}</b><span>cartons jaunes / rouges</span></div>
        </div>
      </section>
      <section className="sec">
        <h2 className="h2">Effectif</h2>
        <div className="card table-box" style={{ padding: '4px 12px' }}>
          <table className="t">
            <thead><tr><th>N°</th><th className="l">Joueur</th><th className="l">Poste</th><th title="Matchs joués">MJ</th><th title="Buts">B</th><th title="Passes décisives">PD</th><th title="Cartons jaunes">CJ</th><th title="Cartons rouges">CR</th></tr></thead>
            <tbody>
              {squad.map((p) => {
                const s = stats.get(p.id);
                return (
                  <tr key={p.id}>
                    <td><b>{p.number}</b></td>
                    <td className="l team"><Link href={`/joueurs/${p.id}`}><Avatar player={p} size={30} />{fullName(p)}{out.has(p.id) ? <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>Suspendu</span> : null}</Link></td>
                    <td className="l">{POSITION_LABELS[p.position] || ''}</td>
                    <td>{s.mj}</td><td>{s.goals}</td><td>{s.assists}</td><td>{s.yellow}</td><td>{s.red}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="sec">
        <h2 className="h2">Matchs et résultats</h2>
        {matches.length ? matches.map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />) : <div className="card pad muted">Aucun match programmé.</div>}
      </section>
    </div>
  );
}
