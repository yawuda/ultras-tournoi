import { getUser } from '@/lib/session.js';
import { backupText } from '@/lib/backup.js';

export const dynamic = 'force-dynamic';

// Téléchargement d'une sauvegarde (fichier .json). « actuel » : copie de l'état actuel.
export async function GET(req, { params }) {
  const user = await getUser();
  if (!user || user.role === 'manager') return new Response('Accès refusé', { status: 403 });
  const { id } = await params;
  try {
    const { text, created_at } = await backupText(user, id);
    const stamp = String(created_at || '').replace(/[^0-9]/g, '').slice(0, 12);
    return new Response(text, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ultras-tournoi-sauvegarde-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response('Sauvegarde introuvable', { status: 404 });
  }
}
