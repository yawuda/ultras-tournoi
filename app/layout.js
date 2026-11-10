import './globals.css';

export const metadata = {
  title: { default: 'Ultras Tournoi · Football 8 contre 8', template: '%s · Ultras Tournoi' },
  description: 'Suivez le tournoi Ultras en direct : matchs, scores, classements, équipes, joueurs et statistiques.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#2B303A' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/logo.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
