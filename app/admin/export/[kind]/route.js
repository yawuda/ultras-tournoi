import { getUser } from '@/lib/session.js';
import { loadTournament } from '@/lib/store.js';
import { exportTable, toHtml } from '@/lib/exportData.js';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const user = await getUser();
  if (!user || user.role === 'manager') return new Response('Accès refusé', { status: 403 });
  const { kind } = await params;
  const T = await loadTournament({ fresh: true });
  const data = exportTable(T, kind);
  if (!data) return new Response('Export inconnu', { status: 404 });
  const format = new URL(req.url).searchParams.get('format');
  if (format === 'pdf') {
    return new Response(toHtml(data, { print: true }), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const html = '﻿' + toHtml(data, { print: false });
  return new Response(html, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="ultras-tournoi-${kind}.xls"`,
      'Cache-Control': 'no-store',
    },
  });
}
