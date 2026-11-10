import Link from 'next/link';
import { requireUser } from '@/lib/session.js';
import { loadFresh } from '@/lib/page.js';
import { matchTitle, sideName, liveLabel } from '@/lib/engine.js';
import { fmtDay, fmtTime } from '@/lib/format.js';
import { Flash, TeamBadge } from '@/components/ui.js';
import AutoRefresh from '@/components/AutoRefresh.js';

function Row({ m, T }) {
  let state = <span className="chip">À venir</span>;
  if (m.status === 'live') state = <span className="chip live"><i />LIVE · {liveLabel(m, T.settings)}</span>;
  else if (m.status === 'finished') state = m.validated ? <span className="chip ok">Validé</span> : <span className="chip warn">À valider</span>;
  return (
    <Link href={`/admin/matchs/${m.id}`} className="card match">
      <div className="match-top"><span>{matchTitle(m)} · {fmtDay(m.kickoff)} {fmtTime(m.kickoff)}</span>{state}</div>
      <div className="match-main">
        <div className="side right"><span className="n">{sideName(m, 'home')}</span><TeamBadge team={m.home} size={30} /></div>
        <div className="mid">{m.status === 'scheduled' ? <span className="time">{fmtTime(m.kickoff)}</span> : <span className="score">{m.hs} – {m.as}</span>}</div>
        <div className="side"><TeamBadge team={m.away} size={30} /><span className="n">{sideName(m, 'away')}</span></div>
      </div>
    </Link>
  );
}

export default async function Dashboard({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const T = await loadFresh();
  const mine = user.role === 'manager' ? T.matches.filter((m) => m.manager_id === user.id) : T.matches;
  const live = mine.filter((m) => m.status === 'live');
  const toValidate = mine.filter((m) => m.status === 'finished' && !m.validated);
  const upcoming = mine.filter((m) => m.status === 'scheduled').slice(0, user.role === 'manager' ? 50 : 4);
  const done = mine.filter((m) => m.official).slice(-4).reverse();
  return (
    <>
      <AutoRefresh seconds={15} />
      <h1 className="h1">{user.role === 'manager' ? 'Mes matchs' : 'Matchs du jour'}</h1>
      <Flash sp={sp} />
      {T.settings.demo === '1' && user.role !== 'manager' ? (
        <p className="flash err" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1e3a8a' }}>
          Mode démonstration : les résultats déjà saisis sont fictifs. Effacez-les dans <Link href="/admin/parametres">Paramètres</Link> avant le vrai tournoi.
        </p>
      ) : null}
      {user.role === 'manager' && mine.length === 0 ? <div className="card pad muted">Aucun match ne vous est encore attribué. Un administrateur doit vous l'attribuer dans le calendrier.</div> : null}
      {live.length ? <section className="sec"><h2 className="h2">En cours</h2>{live.map((m) => <Row key={m.id} m={m} T={T} />)}</section> : null}
      {toValidate.length ? <section className="sec"><h2 className="h2">Résultats à valider</h2>{toValidate.map((m) => <Row key={m.id} m={m} T={T} />)}</section> : null}
      {upcoming.length ? <section className="sec"><h2 className="h2">Prochains matchs</h2>{upcoming.map((m) => <Row key={m.id} m={m} T={T} />)}</section> : null}
      {done.length ? <section className="sec"><h2 className="h2">Derniers résultats validés</h2>{done.map((m) => <Row key={m.id} m={m} T={T} />)}</section> : null}
    </>
  );
}
