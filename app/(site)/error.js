'use client';

export default function SiteError({ reset }) {
  return (
    <div className="wrap narrow" style={{ paddingTop: 48 }}>
      <h1 className="h1">Service momentanément indisponible</h1>
      <p className="muted">Impossible de charger les données du tournoi. Réessayez dans quelques instants.</p>
      <p style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={() => reset()}>Réessayer</button>
      </p>
    </div>
  );
}
