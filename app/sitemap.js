export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';
  return ['', '/matchs', '/classements', '/equipes', '/joueurs', '/statistiques'].map((p) => ({ url: `${base}${p}`, changeFrequency: 'hourly' }));
}
