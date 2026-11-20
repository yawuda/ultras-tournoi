import { dbConfigured } from '@/lib/db.js';
import { autoBackup } from '@/lib/backup.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Appelée chaque nuit par la tâche planifiée Vercel (vercel.json).
// Sans risque si elle est appelée par quelqu'un d'autre : au plus une sauvegarde automatique toutes les 20 heures.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Accès refusé', { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, error: 'Base non configurée' }, { status: 500 });
  try {
    const res = await autoBackup();
    return Response.json({ ok: true, ...res });
  } catch (e) {
    console.error('Sauvegarde automatique impossible', e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
