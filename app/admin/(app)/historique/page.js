import Link from 'next/link';
import { requireUser } from '@/lib/session.js';
import { auditLog } from '@/lib/store.js';

export default async function History() {
  const user = await requireUser(['superadmin', 'admin']);
  const rows = await auditLog(user, 300);
  return (
    <>
      <h1 className="h1">Historique des modifications</h1>
      <div className="card table-box" style={{ padding: '4px 12px' }}>
        <table className="t">
          <thead><tr><th className="l">Date</th><th className="l">Par</th><th className="l">Action</th><th className="l">Match</th><th className="l">Détail</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={5} className="l muted">Aucune modification enregistrée.</td></tr> : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="l" style={{ whiteSpace: 'nowrap' }}>{r.at}</td>
                <td className="l">{r.username}</td>
                <td className="l team">{r.action}</td>
                <td className="l">{r.match_id ? <Link href={`/admin/matchs/${r.match_id}`}>#{r.match_id}</Link> : ''}</td>
                <td className="l">{r.detail || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
