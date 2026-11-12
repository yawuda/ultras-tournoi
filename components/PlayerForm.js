import { savePlayerAction } from '@/app/admin/actions.js';
import { POSITION_LABELS } from '@/lib/engine.js';

export default function PlayerForm({ player, teams, teamId, back }) {
  return (
    <form action={savePlayerAction} className="form-grid">
      {player ? <input type="hidden" name="id" value={player.id} /> : null}
      <input type="hidden" name="back" value={back} />
      <label className="f">Prénom<input name="first_name" defaultValue={player?.first_name || ''} maxLength={60} /></label>
      <label className="f">Nom<input name="last_name" defaultValue={player?.last_name || ''} required maxLength={60} /></label>
      <label className="f">N° maillot<input type="number" name="number" min="0" max="99" defaultValue={player?.number ?? ''} /></label>
      <label className="f">Poste
        <select name="position" defaultValue={player?.position || 'M'}>
          {Object.entries(POSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="f">Équipe
        <select name="team_id" defaultValue={player?.team_id || teamId || ''} required>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="f" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46 }}><input type="checkbox" name="is_captain" value="1" defaultChecked={!!player?.is_captain} style={{ width: 20, height: 20 }} />Capitaine de l'équipe</label>
      <label className="f">Photo<input type="file" name="photo" accept="image/png,image/jpeg,image/webp" /></label>
      {player?.photo_url ? <label className="f" style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" name="remove_photo" value="1" style={{ width: 20, height: 20 }} />Retirer la photo</label> : null}
      <button className="btn primary" type="submit">{player ? 'Enregistrer' : 'Ajouter le joueur'}</button>
    </form>
  );
}
