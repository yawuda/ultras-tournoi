import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { listUsers } from '@/lib/store.js';
import { matchTitle, sideName, suspensions } from '@/lib/engine.js';
import { fmtDayLong, fmtTime } from '@/lib/format.js';
import { Flash } from '@/components/ui.js';
import LiveConsole from '@/components/LiveConsole.js';
import { saveMatchAction, resetMatchAction } from '../../../actions.js';

export default async function AdminMatch({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const T = await loadFresh();
  const m = T.matchById.get(Number(id));
  if (!m) notFound();
  const isAdmin = user.role !== 'manager';
  if (!isAdmin && m.manager_id !== user.id) redirect('/admin?erreur=' + encodeURIComponent("Ce match ne vous est pas attribué."));
  const players = T.players.filter((p) => p.team_id === m.home_id || p.team_id === m.away_id);
  const susp = [...(suspensions(T).byMatch.get(m.id) || [])];
  const users = isAdmin ? await listUsers(user) : [];
  const plain = (x) => JSON.parse(JSON.stringify(x));
  const { home, away, events, lineup, ...rest } = m;
  return (
    <>
      <p style={{ marginTop: 14 }}><Link href={isAdmin ? '/admin/matchs' : '/admin'}>‹ Retour</Link></p>
      <h1 className="h1" style={{ marginTop: 6, marginBottom: 4 }}>{sideName(m, 'home')} – {sideName(m, 'away')}</h1>
      <p className="muted small" style={{ marginBottom: 14 }}>M{m.num} · {matchTitle(m)} · {fmtDayLong(m.kickoff)} · {fmtTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ''} · <Link href={`/matchs/${m.id}`} target="_blank">Voir la page publique ↗</Link></p>
      <Flash sp={sp} />
      {!m.home_id || !m.away_id ? (
        <div className="card pad muted">Les équipes de ce match seront connues automatiquement quand les résultats précédents seront validés.</div>
      ) : (
        <LiveConsole
          match={plain(rest)}
          home={home ? plain(home) : null}
          away={away ? plain(away) : null}
          players={plain(players)}
          events={plain(events)}
          lineup={plain(lineup)}
          settings={plain(T.settings)}
          role={user.role}
          suspended={susp}
        />
      )}
      {isAdmin ? (
        <section className="sec">
          <h2 className="h2">Programmation</h2>
          <form action={saveMatchAction} className="card pad form-grid">
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="back" value={`/admin/matchs/${m.id}`} />
            {m.status !== 'scheduled' || m.phase !== 'group' ? <input type="hidden" name="keep_teams" value="1" /> : null}
            <label className="f">Date<input type="date" name="date" defaultValue={(m.kickoff || '').slice(0, 10)} required /></label>
            <label className="f">Heure<input type="time" name="time" defaultValue={fmtTime(m.kickoff)} required /></label>
            <label className="f">Terrain<input name="venue" defaultValue={m.venue || ''} /></label>
            <label className="f">Responsable de match
              <select name="manager_id" defaultValue={m.manager_id || ''}>
                <option value="">Aucun</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </label>
            {m.status === 'scheduled' && m.phase === 'group' ? (
              <>
                <label className="f">Domicile<select name="home_id" defaultValue={m.home_id || ''}>{T.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <label className="f">Extérieur<select name="away_id" defaultValue={m.away_id || ''}>{T.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              </>
            ) : null}
            <button className="btn primary" type="submit">Enregistrer</button>
          </form>
          {m.status !== 'scheduled' ? (
            <form action={resetMatchAction} className="noprint">
              <input type="hidden" name="id" value={m.id} />
              <details className="card">
                <summary>Remettre ce match à zéro</summary>
                <div className="pad stack">
                  <p className="small muted">Supprime tous les événements et le score, et repasse le match en « À venir ». Action enregistrée dans l'historique.</p>
                  <button className="btn danger" type="submit">Confirmer la remise à zéro</button>
                </div>
              </details>
            </form>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
