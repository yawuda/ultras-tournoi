import { redirect } from 'next/navigation';
import { dbConfigured } from '@/lib/db.js';
import { userCount } from '@/lib/store.js';
import { getUser } from '@/lib/session.js';
import { loginAction, setupAction } from '../../actions.js';
import { Flash } from '@/components/ui.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connexion organisateurs', robots: { index: false } };

export default async function Login({ searchParams }) {
  if (!dbConfigured()) redirect('/installation');
  if (await getUser()) redirect('/admin');
  const sp = await searchParams;
  const first = (await userCount()) === 0;
  return (
    <main className="wrap narrow" style={{ paddingTop: 40, paddingBottom: 40, maxWidth: 440 }}>
      <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}><img src="/logo.png" alt="Ultras Football Academy" height={80} /></div>
      <h1 className="h1" style={{ textAlign: 'center' }}>{first ? 'Créer le compte principal' : 'Espace organisateurs'}</h1>
      <Flash sp={sp} />
      <form action={first ? setupAction : loginAction} className="card pad stack" style={{ marginTop: 14 }}>
        {first ? <p className="small muted">Premier lancement : ce compte sera le super administrateur. Il pourra ensuite créer les comptes des autres organisateurs.</p> : null}
        <label className="f">Nom d'utilisateur<input name="username" autoComplete="username" autoCapitalize="none" required /></label>
        <label className="f">Mot de passe<input name="password" type="password" autoComplete={first ? 'new-password' : 'current-password'} required minLength={first ? 8 : undefined} /></label>
        {first ? <label className="f">Confirmer le mot de passe<input name="password2" type="password" autoComplete="new-password" required minLength={8} /></label> : null}
        <button className="btn primary lg block" type="submit">{first ? 'Créer et se connecter' : 'Se connecter'}</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 16 }}><a href="/">‹ Retour au site public</a></p>
    </main>
  );
}
