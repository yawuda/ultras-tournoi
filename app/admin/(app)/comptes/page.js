import { requireUser } from '@/lib/session.js';
import { listUsers, ROLES } from '@/lib/store.js';
import { Flash } from '@/components/ui.js';
import { createUserAction, deleteUserAction, passwordAction } from '../../actions.js';

export default async function Accounts({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const isSuper = user.role === 'superadmin';
  const users = user.role === 'manager' ? [] : await listUsers(user);
  return (
    <>
      <h1 className="h1">{isSuper ? 'Comptes' : 'Mon compte'}</h1>
      <Flash sp={sp} />
      {users.length ? (
        <div className="card table-box" style={{ padding: '4px 12px' }}>
          <table className="t">
            <thead><tr><th className="l">Utilisateur</th><th className="l">Rôle</th><th className="l">Créé le</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="l team">{u.username}{u.id === user.id ? ' (vous)' : ''}</td>
                  <td className="l">{ROLES[u.role]}</td>
                  <td className="l">{String(u.created_at).slice(0, 10)}</td>
                  <td>
                    {isSuper && u.id !== user.id ? (
                      <span className="row" style={{ justifyContent: 'flex-end' }}>
                        <details>
                          <summary className="btn sm">Mot de passe</summary>
                          <form action={passwordAction} className="row" style={{ marginTop: 6 }}>
                            <input type="hidden" name="id" value={u.id} />
                            <input className="in" type="password" name="password" minLength={8} required placeholder="Nouveau mot de passe" aria-label={`Nouveau mot de passe pour ${u.username}`} />
                            <button className="btn sm primary" type="submit">OK</button>
                          </form>
                        </details>
                        <form action={deleteUserAction}><input type="hidden" name="id" value={u.id} /><button className="btn sm danger" type="submit" aria-label={`Supprimer ${u.username}`}>Suppr.</button></form>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {isSuper ? (
        <section className="sec">
          <h2 className="h2">Créer un compte</h2>
          <form action={createUserAction} className="card pad form-grid">
            <label className="f">Nom d'utilisateur<input name="username" required autoCapitalize="none" pattern="[A-Za-z0-9._\-]{3,30}" /></label>
            <label className="f">Mot de passe (8 car. min.)<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
            <label className="f">Rôle
              <select name="role" defaultValue="manager">
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <button className="btn primary" type="submit">Créer le compte</button>
          </form>
          <p className="small muted">Super administrateur : accès complet. Administrateur : gestion du tournoi et validation des résultats. Responsable de match : saisie des matchs qui lui sont attribués dans le calendrier.</p>
        </section>
      ) : null}
      <section className="sec">
        <h2 className="h2">Changer mon mot de passe</h2>
        <form action={passwordAction} className="card pad form-grid">
          <label className="f">Nouveau mot de passe<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <button className="btn primary" type="submit">Enregistrer</button>
        </form>
      </section>
    </>
  );
}
