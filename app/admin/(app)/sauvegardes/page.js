import { requireUser } from '@/lib/session.js';
import { listBackups } from '@/lib/backup.js';
import { Flash } from '@/components/ui.js';
import { manualBackupAction, restoreBackupAction } from '../../actions.js';

const KINDS = { auto: 'Automatique', manuelle: 'Manuelle', 'avant-restauration': 'Avant restauration' };
const size = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

export default async function Backups({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser(['superadmin', 'admin']);
  const rows = await listBackups(user);
  const superadmin = user.role === 'superadmin';
  const lastAuto = rows.find((r) => r.kind === 'auto');
  return (
    <>
      <h1 className="h1">Sauvegardes</h1>
      <Flash sp={sp} />
      <div className="card pad stack">
        <p className="small">Une copie complète des données (équipes, joueurs, matchs, buts, cartons, compositions, comptes, paramètres et historique) est faite <b>automatiquement chaque nuit vers 4 h</b>. Les 45 dernières sont gardées.</p>
        <p className="small muted">Dernière sauvegarde automatique : {lastAuto ? lastAuto.created_at : 'pas encore faite (la première aura lieu cette nuit)'}.</p>
        <p className="small">Conseil : après chaque soirée de matchs, téléchargez une copie et gardez-la sur votre téléphone ou votre ordinateur.</p>
        <div className="row wrapx">
          <form action={manualBackupAction}><button className="btn primary" type="submit">Faire une sauvegarde maintenant</button></form>
          <a className="btn" href="/admin/sauvegarde/actuel">Télécharger une copie de l'état actuel</a>
        </div>
      </div>

      <section className="sec">
        <h2 className="h2">Sauvegardes enregistrées</h2>
        <div className="card table-box" style={{ padding: '4px 12px' }}>
          <table className="t">
            <thead><tr><th className="l">N°</th><th className="l">Date</th><th className="l">Type</th><th className="l">Contenu</th><th className="l">Taille</th><th className="l"></th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={6} className="l muted">Aucune sauvegarde pour l'instant.</td></tr> : null}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="l">{r.id}</td>
                  <td className="l" style={{ whiteSpace: 'nowrap' }}>{r.created_at}</td>
                  <td className="l">{KINDS[r.kind] || r.kind}{r.kind === 'manuelle' && r.username ? ` (${r.username})` : ''}</td>
                  <td className="l small">{r.summary}</td>
                  <td className="l">{size(r.size)}</td>
                  <td className="l"><a className="btn sm" href={`/admin/sauvegarde/${r.id}`}>Télécharger</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {superadmin ? (
        <section className="sec">
          <h2 className="h2">Restaurer</h2>
          <form action={restoreBackupAction} className="card pad stack">
            <p className="small"><b>Attention :</b> la restauration remplace <b>toutes</b> les données actuelles par celles de la sauvegarde choisie. L'état actuel est d'abord sauvegardé automatiquement (type « Avant restauration »), on peut donc toujours revenir en arrière. Tout le monde devra se reconnecter.</p>
            <div className="form-grid">
              <label className="f">Sauvegarde enregistrée
                <select name="id" defaultValue="">
                  <option value="">— Choisir —</option>
                  {rows.map((r) => <option key={r.id} value={r.id}>N° {r.id} · {r.created_at} · {KINDS[r.kind] || r.kind}</option>)}
                </select>
              </label>
              <label className="f">Ou un fichier téléchargé (.json)<input type="file" name="file" accept="application/json,.json" /></label>
              <label className="f">Tapez RESTAURER pour confirmer<input name="confirm" autoComplete="off" placeholder="RESTAURER" /></label>
            </div>
            <details>
              <summary className="btn">Restaurer…</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                <button className="btn danger" type="submit">Confirmer la restauration</button>
              </div>
            </details>
          </form>
        </section>
      ) : null}
    </>
  );
}
