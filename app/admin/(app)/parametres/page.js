import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { GROUPS, TIEBREAKER_LABELS } from '@/lib/engine.js';
import { Flash } from '@/components/ui.js';
import { settingsAction, clearDemoAction, regenerateDemoAction } from '../../actions.js';

export default async function Settings({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser(['superadmin', 'admin']);
  const T = await loadFresh();
  const s = T.settings;
  let mo = {};
  try { mo = JSON.parse(s.manual_order || '{}'); } catch {}
  const crit = T.tiebreakers;
  return (
    <>
      <h1 className="h1">Paramètres</h1>
      <Flash sp={sp} />
      <form action={settingsAction} className="stack" style={{ gap: 16 }}>
        <div className="card pad form-grid">
          <label className="f">Nom du tournoi<input name="name" defaultValue={s.name || ''} required /></label>
          <label className="f">Sous-titre<input name="subtitle" defaultValue={s.subtitle || ''} /></label>
          <label className="f">Lieu / terrain<input name="venue" defaultValue={s.venue || ''} /></label>
          <label className="f">Date de début réelle<input type="date" name="start_date" defaultValue={s.start_date || ''} /></label>
          <label className="f">Horaires des matchs du jour<input name="match_times" defaultValue={s.match_times || '16:00,17:15'} placeholder="16:00,17:15" /></label>
          <label className="f">Durée d'une mi-temps (min)<input type="number" name="half_minutes" min="1" defaultValue={s.half_minutes || 25} /></label>
          <label className="f">Durée d'une période de prolongation (min)<input type="number" name="et_minutes" min="1" defaultValue={s.et_minutes || 10} /></label>
          <label className="f">Suspension après N cartons jaunes<input type="number" name="yellow_suspension" min="1" defaultValue={s.yellow_suspension || 3} /></label>
          <label className="f">Bannière (photo)<input type="file" name="banner" accept="image/png,image/jpeg,image/webp" /></label>
          {s.banner_url ? <label className="f" style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" name="remove_banner" value="1" style={{ width: 20, height: 20 }} />Retirer la bannière</label> : null}
          <label className="f">Logo du tournoi<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
          {s.logo_url ? <label className="f" style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" name="remove_logo" value="1" style={{ width: 20, height: 20 }} />Revenir au logo par défaut</label> : null}
        </div>
        <div className="card pad stack">
          <b>Ordre des critères de départage</b>
          <div className="form-grid">
            {crit.map((c, i) => (
              <label key={i} className="f">Critère {i + 1}
                <select name="tb" defaultValue={c}>
                  {Object.entries(TIEBREAKER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            ))}
          </div>
          <b style={{ marginTop: 8 }}>Départage manuel (égalité parfaite, tirage au sort…)</b>
          <p className="small muted">Si deux équipes restent à égalité après tous les critères, saisissez l'ordre décidé par l'organisation avec les abréviations, séparées par des virgules (ex. : E3,E1).</p>
          <div className="form-grid">
            {GROUPS.map((g) => <label key={g} className="f">Groupe {g}<input name={`mo_${g}`} defaultValue={mo[g] || ''} placeholder="Ex. : E3,E1" /></label>)}
          </div>
        </div>
        <button className="btn primary lg" type="submit">Enregistrer les paramètres</button>
      </form>

      <section className="sec">
        <h2 className="h2">Données de démonstration</h2>
        <div className="card pad stack">
          <p className="small">
            {s.demo === '1' ? 'Les résultats actuellement affichés sont fictifs (bandeau « Données de démonstration » sur le site).' : 'Aucun résultat fictif en cours.'}
          </p>
          <form action={clearDemoAction}>
            <details>
              <summary className="btn">Effacer les résultats fictifs</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                <p className="small muted">Les matchs fictifs repassent « À venir ». Équipes et joueurs sont conservés, et le calendrier est recalé à partir de la date de début réelle (2 matchs par jour, du lundi au vendredi, aux horaires indiqués ci-dessus). Il suffit ensuite de renommer les équipes et de saisir les vrais joueurs.</p>
                <button className="btn danger" type="submit">Confirmer</button>
              </div>
            </details>
          </form>
          {user.role === 'superadmin' ? (
            <form action={regenerateDemoAction}>
              <details>
                <summary className="btn">Tout régénérer en démonstration</summary>
                <div className="stack" style={{ marginTop: 8 }}>
                  <p className="small muted">Remplace TOUTES les équipes, joueurs, matchs et résultats par un jeu de démonstration neuf. Les comptes sont conservés.</p>
                  <button className="btn danger" type="submit">Confirmer la régénération</button>
                </div>
              </details>
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}
