import Link from 'next/link';
import { liveLabel, sideName, matchTitle, groupStandings } from '@/lib/engine.js';
import { fmtDay, fmtTime, shortName, fullName } from '@/lib/format.js';

export function TeamBadge({ team, size = 36 }) {
  if (!team) return <span className="badge badge-empty" style={{ width: size, height: size, fontSize: 12 }}>?</span>;
  if (team.logo_url) return <img className="badge-img" src={team.logo_url} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  return (
    <span className="badge" style={{ width: size, height: size, background: team.color || '#2B303A', fontSize: Math.max(9, Math.round(size * 0.3)) }}>
      {team.short}
    </span>
  );
}

export function Avatar({ player, size = 44 }) {
  if (player?.photo_url) return <img className="avatar" src={player.photo_url} alt="" style={{ width: size, height: size }} />;
  const ini = `${player?.first_name?.[0] || ''}${player?.last_name?.[0] || ''}`;
  return <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>{ini}</span>;
}

export function StatusChip({ m, settings }) {
  if (m.status === 'live') return <span className="chip live"><i />LIVE · {liveLabel(m, settings)}</span>;
  if (m.status === 'finished') return m.validated ? <span className="chip">Terminé</span> : <span className="chip warn">Terminé · à valider</span>;
  return <span className="chip">À venir</span>;
}

export function ScoreMid({ m, big = false }) {
  if (m.status === 'scheduled') return <div className="mid"><span className="time">{fmtTime(m.kickoff) || '–'}</span></div>;
  return (
    <div className="mid">
      <span className={big ? 'score big' : 'score'}>{m.hs} – {m.as}</span>
      {m.home_pens != null && m.away_pens != null ? <span className="pens">t.a.b. {m.home_pens} – {m.away_pens}</span> : null}
    </div>
  );
}

export function MatchCard({ m, settings, href }) {
  return (
    <Link href={href || `/matchs/${m.id}`} className="card match">
      <div className="match-top">
        <span>{matchTitle(m)} · {fmtDay(m.kickoff)} {fmtTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ''}</span>
        <StatusChip m={m} settings={settings} />
      </div>
      <div className="match-main">
        <div className="side right"><span className="n">{sideName(m, 'home')}</span><TeamBadge team={m.home} size={34} /></div>
        <ScoreMid m={m} />
        <div className="side"><TeamBadge team={m.away} size={34} /><span className="n">{sideName(m, 'away')}</span></div>
      </div>
    </Link>
  );
}

export function StandingsTable({ T, grp, full = true }) {
  const rows = groupStandings(T, grp);
  const tied = rows.some((r) => r.tied);
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div className="row between" style={{ padding: '2px 2px 4px' }}>
        <h3 className="h2" style={{ fontSize: 21 }}>Groupe {grp}</h3>
      </div>
      <div className="table-box">
        <table className="t">
          <thead>
            <tr>
              <th>#</th><th className="l">Équipe</th><th title="Matchs joués">J</th>
              {full ? (<><th title="Victoires">V</th><th title="Nuls">N</th><th title="Défaites">D</th><th title="Buts marqués">BP</th><th title="Buts encaissés">BC</th></>) : null}
              <th title="Différence de buts">Diff</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id}>
                <td><span className={r.pos <= 2 ? 'pos q' : 'pos'}>{r.pos}</span></td>
                <td className="l team"><Link href={`/equipes/${r.team.id}`}><TeamBadge team={r.team} size={24} />{r.team.name}{r.tied ? ' *' : ''}</Link></td>
                <td>{r.j}</td>
                {full ? (<><td>{r.v}</td><td>{r.n}</td><td>{r.d}</td><td>{r.bp}</td><td>{r.bc}</td></>) : null}
                <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                <td className="pts">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tied ? <p className="small muted" style={{ paddingTop: 6 }}>* Égalité parfaite : départage par décision de l'organisateur.</p> : null}
    </div>
  );
}

export function EventIcon({ type }) {
  if (type === 'yellow') return <span className="cardico y" role="img" aria-label="Carton jaune" />;
  if (type === 'red') return <span className="cardico r" role="img" aria-label="Carton rouge" />;
  if (type === 'sub')
    return (
      <svg role="img" aria-label="Remplacement" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d4756" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4" />
      </svg>
    );
  return (
    <svg role="img" aria-label="But" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={type === 'own_goal' ? '#d92d20' : '#2f62b8'} strokeWidth="2" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8l4 3-1.5 4.5h-5L8 11z" />
    </svg>
  );
}

export function eventText(e, T) {
  const p = T.playerById.get(e.player_id);
  const name = p ? shortName(p) : null;
  if (e.type === 'goal') {
    const a = T.playerById.get(e.assist_id);
    return { title: `But${name ? ` · ${name}` : ''}`, sub: a ? `Passe décisive : ${shortName(a)}` : '' };
  }
  if (e.type === 'own_goal') return { title: `But contre son camp${name ? ` · ${name}` : ''}`, sub: '' };
  if (e.type === 'yellow') return { title: `Carton jaune · ${name || '?'}`, sub: '' };
  if (e.type === 'red') return { title: `Carton rouge · ${name || '?'}`, sub: '' };
  const pin = T.playerById.get(e.player_in_id);
  return { title: 'Remplacement', sub: `Entre : ${pin ? shortName(pin) : '?'} · Sort : ${name || '?'}` };
}

export function RankList({ rows, unit, limit }) {
  const list = limit ? rows.slice(0, limit) : rows;
  if (!list.length) return <div className="card pad muted">Aucune donnée pour le moment.</div>;
  return (
    <div className="card">
      {list.map((s) => (
        <Link key={s.player.id} href={`/joueurs/${s.player.id}`} className="list-row">
          <span className={s.rank === 1 ? 'rank r1' : 'rank'}>{s.rank}</span>
          <span className="row" style={{ minWidth: 0 }}>
            <Avatar player={s.player} size={36} />
            <span style={{ minWidth: 0 }}>
              <b style={{ display: 'block' }}>{fullName(s.player)}</b>
              <span className="small muted">{s.team?.name}</span>
            </span>
          </span>
          <span><b className="v">{s.value}</b> <span className="small muted">{unit}</span></span>
        </Link>
      ))}
    </div>
  );
}

export function Flash({ sp }) {
  if (sp?.erreur) return <p className="flash err" role="alert">{String(sp.erreur)}</p>;
  if (sp?.ok) return <p className="flash ok" role="status">Enregistré.</p>;
  return null;
}
