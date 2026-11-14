import Link from 'next/link';
import { loadT } from '@/lib/page.js';
import { groupsOf, TIEBREAKER_LABELS, thirdsRanking, bestThirdsCount, allGroupsComplete, CROSS_LABELS } from '@/lib/engine.js';
import { fr } from '@/lib/format.js';
import { StandingsTable, MatchCard, TeamBadge } from '@/components/ui.js';

export const metadata = { title: 'Classements et phase finale', description: 'Classements des groupes, meilleurs troisièmes et tableau de la phase finale.' };

export default async function Classements() {
  const T = await loadT();
  const groups = groupsOf(T);
  const nThirds = bestThirdsCount(T);
  const thirds = nThirds ? thirdsRanking(T) : [];
  const done = allGroupsComplete(T);
  const by = (phase) => T.matches.filter((m) => m.phase === phase);
  return (
    <div className="wrap">
      <h1 className="h1">Classements</h1>
      <div className="grid-auto">
        {groups.map((g) => <StandingsTable key={g} T={T} grp={g} />)}
      </div>
      <div className="legend">
        <span><i />1er et 2e : qualifiés pour les quarts de finale</span>
        {nThirds ? <span><i className="q3" />{nThirds} meilleurs 3es : qualifiés{done ? '' : ' (provisoire)'}</span> : null}
        <span><i className="out" />Éliminés</span>
      </div>

      {nThirds ? (
        <section className="sec">
          <h2 className="h2">Classement des 3es</h2>
          <div className="card table-box" style={{ padding: '10px 12px' }}>
            <table className="t">
              <thead>
                <tr><th>#</th><th className="l">Équipe</th><th>Gr.</th><th>J</th><th>Pts</th><th title="Points par match">Pts/m</th><th title="Différence de buts par match">Diff/m</th><th title="Buts marqués par match">BP/m</th></tr>
              </thead>
              <tbody>
                {thirds.map((r, i) => (
                  <tr key={r.team.id}>
                    <td><span className={i < nThirds ? 'pos q3' : 'pos'}>{i + 1}</span></td>
                    <td className="l team"><Link href={`/equipes/${r.team.id}`}><TeamBadge team={r.team} size={24} /><span className="tn">{r.team.name}</span></Link></td>
                    <td>{r.grp}</td><td>{r.j}</td><td className="pts">{r.pts}</td>
                    <td>{r.j ? fr(r.pts / r.j, 2) : '–'}</td><td>{r.j ? fr(r.diff / r.j, 2) : '–'}</td><td>{r.j ? fr(r.bp / r.j, 2) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ paddingTop: 8 }}>Les groupes n'ont pas le même nombre d'équipes : les 3es sont comparés à la moyenne par match ({CROSS_LABELS.join(', ').toLowerCase()}).</p>
          </div>
        </section>
      ) : null}

      <div className="card pad" style={{ marginTop: 14 }}>
        <b>Critères de départage dans un groupe</b>
        <ol className="steps small" style={{ margin: '6px 0 0' }}>
          {T.tiebreakers.map((c) => <li key={c}>{TIEBREAKER_LABELS[c]}</li>)}
        </ol>
        <p className="small muted">Victoire 3 points, nul 1 point, défaite 0 point. Seuls les résultats validés par l'organisation sont comptés.</p>
      </div>

      <section className="sec">
        <h2 className="h2">Phase finale</h2>
        <p className="small muted">Les affiches se remplissent automatiquement à la fin des groupes. En cas d'égalité : prolongation de 2 × {T.settings.et_minutes || 10} minutes, puis tirs au but.</p>
        <div className="bracket">
          <div className="col">
            <h3>Quarts de finale</h3>
            {by('qf').map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
          </div>
          <div className="col">
            <h3>Demi-finales</h3>
            {by('sf').map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
            {by('fifth').length ? <h3>5e place</h3> : null}
            {by('fifth').map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
          </div>
          <div className="col">
            <h3>Finale</h3>
            {by('final').map((m) => <div key={m.id} className="card final"><MatchCard m={m} settings={T.settings} /></div>)}
            <h3>3e place</h3>
            {by('third').map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
