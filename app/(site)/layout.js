import Link from 'next/link';
import Nav from '@/components/Nav.js';
import AutoRefresh from '@/components/AutoRefresh.js';
import { loadT } from '@/lib/page.js';

export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }) {
  const T = await loadT();
  const name = T.settings.name || 'Ultras Tournoi';
  return (
    <>
      {T.settings.demo === '1' ? <div className="demo-bar">Données de démonstration : équipes, joueurs et résultats fictifs</div> : null}
      <header className="top">
        <div className="wrap">
          <Link href="/" className="brand">
            <img src={T.settings.logo_url || '/logo.png'} alt="" />
            {name}
          </Link>
          <Nav />
        </div>
      </header>
      <main>{children}</main>
      <footer className="foot">
        <div className="wrap">
          {name} · {T.settings.subtitle || 'Football 8 contre 8'} · <Link href="/admin">Espace organisateurs</Link>
        </div>
      </footer>
      <AutoRefresh seconds={10} />
    </>
  );
}
