import { loadT } from '@/lib/page.js';
import { GROUPS, TIEBREAKER_LABELS } from '@/lib/engine.js';
import { StandingsTable, MatchCard } from '@/components/ui.js';

export const metadata = { title: 'Classements et phase finale', description: 'Classements des quatre groupes et tableau de la phase finale.' };

export default async function Classements() {
  const T = await loadT();
  const by = (phase) => T.matches.filter((m) => m.phase === phase).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const qf = by('qf');
  const order = ['QF1', 'QF3', 'QF2', 'QF4'];
  qf.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  return (
    <div className="wrap">
      <h1 className="h1">Classements</h1>
      <div className="grid-auto">
        {GROUPS.map((g) => <StandingsTable key={g} T={T} grp={g} />)}
      </div>
      <div className="legend">
        <span><i />1er et 2e : qualifiés pour les quarts de finale</span>
        <span><i className="out" />3e et 4e : éliminés</span>
      </div>
      <div className="card pad" style={{ marginTop: 14 }}>
        <b>Critères de départage</b>
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
            {qf.map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
          </div>
          <div className="col">
            <h3>Demi-finales</h3>
            {by('sf').map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
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
