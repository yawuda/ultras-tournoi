import Link from 'next/link';
import { loadT } from '@/lib/page.js';
import { GROUPS, STATUS_LABELS, tournamentStatus, tournamentStats, qualifiedTeams, playerStats, ranking } from '@/lib/engine.js';
import { fmtDay, fullName, fr } from '@/lib/format.js';
import { MatchCard, StandingsTable, TeamBadge, Avatar, RankList } from '@/components/ui.js';

export default async function Home() {
  const T = await loadT();
  const s = T.settings;
  const status = tournamentStatus(T);
  const live = T.matches.filter((m) => m.status === 'live');
  const next = T.matches.find((m) => m.status === 'scheduled');
  const last = T.matches.filter((m) => m.status === 'finished').slice(-3).reverse();
  const stats = tournamentStats(T);
  const scorers = ranking(playerStats(T), 'goals');
  const qualified = qualifiedTeams(T);
  const first = T.matches[0];
  const lastMatch = T.matches[T.matches.length - 1];
  return (
    <>
      <section className={s.banner_url ? 'hero photo' : 'hero'} style={s.banner_url ? { backgroundImage: `url(${s.banner_url})` } : undefined}>
        {s.banner_url ? null : (
          <svg className="pitch" aria-hidden="true" width="420" height="300" viewBox="0 0 420 300" fill="none" stroke="#5b6676" strokeWidth="2">
            <circle cx="210" cy="150" r="80" />
            <path d="M0 150h420M130 300v-70h160v70M130 0v70h160V0" />
          </svg>
        )}
        <div className="wrap">
          <span className="status"><i />{STATUS_LABELS[status]}</span>
          <h1>{s.name || 'Ultras Tournoi'}</h1>
          <p>
            {s.subtitle || 'Football 8 contre 8'} · {T.teams.length} équipes · {s.venue || ''}
            {first ? ` · du ${fmtDay(first.kickoff)} au ${fmtDay(lastMatch.kickoff)}` : ''}
          </p>
        </div>
      </section>

      <div className="wrap">
        {live.length ? (
          <section className="sec">
            <h2 className="h2">En direct</h2>
            {live.map((m) => <MatchCard key={m.id} m={m} settings={s} />)}
          </section>
        ) : null}

        {next ? (
          <section className="sec">
            <h2 className="h2">Prochain match</h2>
            <MatchCard m={next} settings={s} />
          </section>
        ) : null}

        <section className="sec">
          <div className="sec-head">
            <h2 className="h2">Derniers résultats</h2>
            <Link href="/matchs">Tous les matchs</Link>
          </div>
          {last.length ? last.map((m) => <MatchCard key={m.id} m={m} settings={s} />) : <div className="card pad muted">Aucun match joué pour le moment.</div>}
        </section>

        <section className="sec">
          <div className="sec-head">
            <h2 className="h2">Classements</h2>
            <Link href="/classements">Détail et phase finale</Link>
          </div>
          <div className="grid-auto">
            {GROUPS.map((g) => <StandingsTable key={g} T={T} grp={g} full={false} />)}
          </div>
          <div className="legend"><span><i />Qualifié pour les quarts de finale</span></div>
        </section>

        <section className="sec">
          <h2 className="h2">Équipes qualifiées</h2>
          {qualified.length ? (
            <div className="grid-teams">
              {qualified.map((x) => (
                <Link key={x.team.id} href={`/equipes/${x.team.id}`} className="card pad row" style={{ color: 'inherit' }}>
                  <TeamBadge team={x.team} size={36} />
                  <span><b style={{ display: 'block' }}>{x.team.name}</b><span className="small muted">{x.pos === 1 ? '1er' : '2e'} du groupe {x.grp}</span></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card pad muted">Les qualifiés seront connus à la fin de chaque groupe (2 premiers de chaque groupe).</div>
          )}
        </section>

        <section className="sec">
          <div className="sec-head">
            <h2 className="h2">Meilleurs buteurs</h2>
            <Link href="/statistiques">Toutes les statistiques</Link>
          </div>
          {scorers.length >= 2 ? (
            <div className="grid2">
              {scorers.slice(0, 2).map((x) => (
                <Link key={x.player.id} href={`/joueurs/${x.player.id}`} className={x.rank === 1 ? 'card podium first' : 'card podium'}>
                  <span className="row"><span className={x.rank === 1 ? 'rank r1' : 'rank'}>{x.rank}</span><b>{fullName(x.player)}</b></span>
                  <span className="row between">
                    <Avatar player={x.player} size={60} />
                    <span><span className="bignum" style={{ display: 'block' }}>{x.value}</span><span className="small muted">buts</span></span>
                  </span>
                  <span className="small muted">{x.team?.name} · n° {x.player.number}</span>
                </Link>
              ))}
            </div>
          ) : null}
          <RankList rows={scorers.slice(scorers.length >= 2 ? 2 : 0, 6)} unit="buts" />
        </section>

        <section className="sec">
          <h2 className="h2">Le tournoi en chiffres</h2>
          <div className="grid2">
            <div className="card tile"><b>{stats.played}</b><span>matchs disputés sur {stats.total}</span></div>
            <div className="card tile"><b>{stats.goals}</b><span>buts marqués</span></div>
            <div className="card tile"><b>{fr(stats.avg)}</b><span>buts par match</span></div>
            <div className="card tile"><b>{stats.yellow} / {stats.red}</b><span>cartons jaunes / rouges</span></div>
          </div>
        </section>
      </div>
    </>
  );
}
