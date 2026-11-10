import { saveTeamAction } from '@/app/admin/actions.js';
import { GROUPS } from '@/lib/engine.js';

export default function TeamForm({ team }) {
  const back = team ? `/admin/equipes/${team.id}` : '/admin/equipes';
  return (
    <form action={saveTeamAction} className="card pad form-grid">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <input type="hidden" name="back" value={back} />
      <label className="f">Nom<input name="name" defaultValue={team?.name || ''} required maxLength={60} /></label>
      <label className="f">Abréviation (4 car.)<input name="short" defaultValue={team?.short || ''} maxLength={4} /></label>
      <label className="f">Groupe
        <select name="grp" defaultValue={team?.grp || ''}>
          <option value="">Aucun</option>
          {GROUPS.map((g) => <option key={g} value={g}>Groupe {g}</option>)}
        </select>
      </label>
      <label className="f">Entraîneur / responsable<input name="coach" defaultValue={team?.coach || ''} maxLength={80} /></label>
      <label className="f">Couleur<input type="color" name="color" defaultValue={team?.color || '#2B303A'} /></label>
      <label className="f">Logo<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
      {team?.logo_url ? <label className="f" style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" name="remove_logo" value="1" style={{ width: 20, height: 20 }} />Retirer le logo</label> : null}
      <button className="btn primary" type="submit">{team ? 'Enregistrer' : "Ajouter l'équipe"}</button>
    </form>
  );
}
