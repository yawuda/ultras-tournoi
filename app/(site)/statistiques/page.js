import Link from 'next/link';
import { loadT } from '@/lib/page.js';
import { tournamentStats, playerStats, ranking } from '@/lib/engine.js';
import { fr, fullName } from '@/lib/format.js';
import { RankList, TeamBadge } from '@/components/ui.js';

export const metadata = { title: 'Statistiques', description: 'Buteurs, passeurs, meilleures attaques et défenses du tournoi.' };

function Leaders({ rows, unit }) {
  const top = rows.filter((r) => r.rank === 1);
  if (!top.length) return <span className="muted">Pas encore de données</span>;
  return <span>{top.map((r) => fullName(r.player)).join(', ')} <span className="muted">({top[0].value} {unit})</span></span>;
}
function Teams({ rows, value, unit }) {
  if (!rows.length) return <span className="muted">Pas encore de données</span>;
  return (
    <span className="row wrapx">
      {rows.map((r) => <Link key={r.team.id} href={`/equipes/${r.team.id}`} className="row"><TeamBadge team={r.team} size={22} /><b>{r.team.name}</b></Link>)}
      <span className="muted">({value(rows[0])} {unit})</span>
    </span>
  );
}

export default async function Stats() {
  const T = await loadT();
  const st = tournamentStats(T);
  const ps = playerStats(T);
  const scorers = ranking(ps, 'goals');
  const assists = ranking(ps, 'assists');
  return (
    <div className="wrap">
      <h1 className="h1">Statistiques</h1>
      <div className="grid2">
        <div className="card tile"><b>{st.played}</b><span>matchs disputés sur {st.total}</span></div>
        <div className="card tile"><b>{st.goals}</b><span>buts au total</span></div>
        <div className="card tile"><b>{fr(st.avg)}</b><span>buts par match</span></div>
        <div className="card tile"><b>{st.yellow} / {st.red}</b><span>cartons jaunes / rouges</span></div>
      </div>
      <div className="card stack pad" style={{ marginTop: 12 }}>
        <p><span className="step-l">Meilleur buteur</span><br /><Leaders rows={scorers} unit="buts" /></p>
        <p><span className="step-l">Meilleur passeur</span><br /><Leaders rows={assists} unit="passes" /></p>
        <div><span className="step-l">Meilleure attaque</span><br /><Teams rows={st.bestAttack} value={(r) => r.bp} unit="buts marqués" /></div>
        <div><span className="step-l">Meilleure défense</span><br /><Teams rows={st.bestDefense} value={(r) => r.bc} unit="buts encaissés" /></div>
      </div>
      <section className="sec">
        <h2 className="h2">Classement des buteurs</h2>
        <RankList rows={scorers} unit="buts" limit={30} />
      </section>
      <section className="sec">
        <h2 className="h2">Classement des passeurs</h2>
        <RankList rows={assists} unit="passes" limit={30} />
      </section>
      <p className="small muted" style={{ marginTop: 10 }}>En cas d'égalité, les joueurs partagent le même rang.</p>
    </div>
  );
}
