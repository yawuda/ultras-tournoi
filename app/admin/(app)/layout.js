import Link from 'next/link';
import { requireUser } from '@/lib/session.js';
import { ROLES } from '@/lib/store.js';
import { logoutAction } from '../actions.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Back-office', robots: { index: false } };

export default async function AdminLayout({ children }) {
  const user = await requireUser();
  const admin = user.role !== 'manager';
  return (
    <>
      <header className="admin-top">
        <div className="wrap">
          <Link href="/admin" className="row" style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 20 }}>
            <img src="/logo.png" alt="" height={36} />BACK-OFFICE
          </Link>
          <nav className="admin-nav" aria-label="Back-office">
            <Link href="/admin">Matchs du jour</Link>
            {admin ? (
              <>
                <Link href="/admin/matchs">Calendrier</Link>
                <Link href="/admin/equipes">Équipes</Link>
                <Link href="/admin/joueurs">Joueurs</Link>
                <Link href="/admin/exports">Exports</Link>
                <Link href="/admin/historique">Historique</Link>
                <Link href="/admin/parametres">Paramètres</Link>
              </>
            ) : null}
            <Link href="/admin/comptes">{user.role === 'superadmin' ? 'Comptes' : 'Mon compte'}</Link>
            <Link href="/" target="_blank">Site public ↗</Link>
          </nav>
          <form action={logoutAction} className="row small">
            <span style={{ color: '#d5dae3' }}>{user.username} · {ROLES[user.role]}</span>
            <button className="btn sm" type="submit">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="wrap" style={{ paddingBottom: 60 }}>{children}</main>
    </>
  );
}
