import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap narrow" style={{ paddingTop: 48 }}>
      <h1 className="h1">Page introuvable</h1>
      <p><Link href="/">Retour à l'accueil</Link></p>
    </div>
  );
}
