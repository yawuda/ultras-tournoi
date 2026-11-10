import { loadT } from '@/lib/page.js';
import { PHASE_LABELS, GROUPS } from '@/lib/engine.js';
import { fmtDayLong } from '@/lib/format.js';
import { MatchCard } from '@/components/ui.js';

export const metadata = { title: 'Calendrier des matchs', description: 'Tous les matchs du tournoi : dates, heures, scores et résultats en direct.' };

export default async function Matchs({ searchParams }) {
  const sp = await searchParams;
  const T = await loadT();
  const f = { phase: sp.phase || '', grp: sp.groupe || '', statut: sp.statut || '', date: sp.date || '' };
  const dates = [...new Set(T.matches.map((m) => (m.kickoff || '').slice(0, 10)).filter(Boolean))];
  const list = T.matches.filter(
    (m) => (!f.phase || m.phase === f.phase) && (!f.grp || m.grp === f.grp) && (!f.statut || m.status === f.statut) && (!f.date || (m.kickoff || '').startsWith(f.date))
  );
  const byDay = new Map();
  for (const m of list) {
    const d = (m.kickoff || '').slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(m);
  }
  return (
    <div className="wrap">
      <h1 className="h1">Matchs</h1>
      <form className="filters" method="get">
        <select name="phase" defaultValue={f.phase} aria-label="Phase">
          <option value="">Toutes les phases</option>
          {Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="groupe" defaultValue={f.grp} aria-label="Groupe">
          <option value="">Tous les groupes</option>
          {GROUPS.map((g) => <option key={g} value={g}>Groupe {g}</option>)}
        </select>
        <select name="statut" defaultValue={f.statut} aria-label="Statut">
          <option value="">Tous les statuts</option>
          <option value="scheduled">À venir</option>
          <option value="live">En cours</option>
          <option value="finished">Terminé</option>
        </select>
        <select name="date" defaultValue={f.date} aria-label="Date">
          <option value="">Toutes les dates</option>
          {dates.map((d) => <option key={d} value={d}>{fmtDayLong(d)}</option>)}
        </select>
        <button className="btn primary" type="submit">Filtrer</button>
      </form>
      {list.length === 0 ? <div className="card pad muted" style={{ marginTop: 16 }}>Aucun match ne correspond à ces filtres.</div> : null}
      {[...byDay.entries()].map(([d, ms]) => (
        <section className="sec" key={d || 'x'}>
          <h2 className="h2" style={{ fontSize: 20 }}>{fmtDayLong(d)}</h2>
          {ms.map((m) => <MatchCard key={m.id} m={m} settings={T.settings} />)}
        </section>
      ))}
    </div>
  );
}
