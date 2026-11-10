import Link from 'next/link';
import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { listUsers } from '@/lib/store.js';
import { matchTitle, sideName, PHASE_LABELS } from '@/lib/engine.js';
import { fmtDay, fmtTime } from '@/lib/format.js';
import { Flash } from '@/components/ui.js';
import { saveMatchAction, deleteMatchAction } from '../../actions.js';

export default async function AdminMatches({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser(['superadmin', 'admin']);
  const T = await loadFresh();
  const users = await listUsers(user);
  const uname = new Map(users.map((u) => [u.id, u.username]));
  return (
    <>
      <h1 className="h1">Calendrier</h1>
      <Flash sp={sp} />
      <div className="card table-box" style={{ padding: '4px 12px' }}>
        <table className="t">
          <thead><tr><th className="l">Date</th><th className="l">Match</th><th>Score</th><th className="l">Statut</th><th className="l">Responsable</th><th></th></tr></thead>
          <tbody>
            {T.matches.map((m) => (
              <tr key={m.id}>
                <td className="l" style={{ whiteSpace: 'nowrap' }}>{fmtDay(m.kickoff)} {fmtTime(m.kickoff)}</td>
                <td className="l team"><Link href={`/admin/matchs/${m.id}`}>{sideName(m, 'home')} – {sideName(m, 'away')}</Link><span className="small muted">{matchTitle(m)}</span></td>
                <td>{m.status === 'scheduled' ? '–' : `${m.hs} – ${m.as}`}</td>
                <td className="l">{m.status === 'live' ? <span className="chip live"><i />LIVE</span> : m.status === 'finished' ? (m.validated ? <span className="chip ok">Validé</span> : <span className="chip warn">À valider</span>) : <span className="chip">À venir</span>}</td>
                <td className="l">{uname.get(m.manager_id) || <span className="muted">—</span>}</td>
                <td>
                  <span className="row" style={{ justifyContent: 'flex-end' }}>
                    <Link className="btn sm" href={`/admin/matchs/${m.id}`}>Ouvrir</Link>
                    {m.status === 'scheduled' ? (
                      <form action={deleteMatchAction}><input type="hidden" name="id" value={m.id} /><button className="btn sm danger" type="submit" aria-label={`Supprimer le match ${m.code || m.id}`}>Suppr.</button></form>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="sec">
        <h2 className="h2">Créer un match</h2>
        <p className="small muted">Le calendrier complet (24 matchs de groupes + phase finale) est déjà généré. Utilisez ce formulaire seulement pour un match supplémentaire.</p>
        <form action={saveMatchAction} className="card pad form-grid">
          <label className="f">Phase<select name="phase" defaultValue="group">{Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="f">Domicile<select name="home_id" required defaultValue=""><option value="" disabled>Choisir</option>{T.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="f">Extérieur<select name="away_id" required defaultValue=""><option value="" disabled>Choisir</option>{T.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="f">Date<input type="date" name="date" required /></label>
          <label className="f">Heure<input type="time" name="time" required /></label>
          <label className="f">Terrain<input name="venue" defaultValue={T.settings.venue || ''} /></label>
          <label className="f">Journée<input type="number" name="round" min="1" max="3" /></label>
          <button className="btn primary" type="submit">Créer</button>
        </form>
      </section>
    </>
  );
}
