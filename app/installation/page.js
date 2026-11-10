import { redirect } from 'next/navigation';
import { dbConfigured } from '@/lib/db.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Installation' };

export default function Installation() {
  if (dbConfigured()) redirect('/');
  return (
    <main className="wrap narrow" style={{ paddingTop: 48 }}>
      <img src="/logo.png" alt="Ultras Football Academy" height={72} />
      <h1 className="h1">Dernière étape : connecter la base de données</h1>
      <div className="card pad">
        <p>Le site est déployé, mais aucune base de données n'est encore reliée au projet.</p>
        <ol className="steps">
          <li>Ouvrez le projet dans Vercel, onglet <strong>Storage</strong>.</li>
          <li>Cliquez sur <strong>Create Database</strong>, choisissez <strong>Neon (Postgres)</strong> et validez.</li>
          <li>Reliez la base au projet (environnement Production), puis relancez un déploiement.</li>
        </ol>
        <p className="muted">Les tables et les données de démonstration se créent toutes seules à la première visite.</p>
      </div>
    </main>
  );
}
