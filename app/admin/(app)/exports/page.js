import { requireUser } from '@/lib/session.js';

const ITEMS = [
  ['classements', 'Classements des 4 groupes'],
  ['buteurs', 'Classement des buteurs'],
  ['passeurs', 'Classement des passeurs'],
  ['joueurs', 'Statistiques de tous les joueurs'],
  ['equipes', 'Statistiques des équipes'],
  ['matchs', 'Tous les matchs et résultats'],
];

export default async function Exports() {
  await requireUser(['superadmin', 'admin']);
  return (
    <>
      <h1 className="h1">Exports</h1>
      <p className="muted small" style={{ marginBottom: 14 }}>Excel : fichier .xls qui s'ouvre directement dans Excel. PDF : la page s'ouvre prête à imprimer, choisissez « Enregistrer en PDF ».</p>
      <div className="stack">
        {ITEMS.map(([k, label]) => (
          <div key={k} className="card pad row between wrapx">
            <b>{label}</b>
            <span className="row">
              <a className="btn sm" href={`/admin/export/${k}?format=xls`}>Excel</a>
              <a className="btn sm primary" href={`/admin/export/${k}?format=pdf`} target="_blank">PDF</a>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
