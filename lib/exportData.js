import { GROUPS, groupStandings, playerStats, ranking, teamRecord, matchTitle, sideName, POSITION_LABELS } from './engine.js';
import { fullName, fmtDay, fmtTime } from './format.js';

// Renvoie { title, sections: [{ title, head: [], rows: [[]] }] }
export function exportTable(T, kind) {
  const ps = playerStats(T);
  const name = T.settings.name || 'Ultras Tournoi';
  if (kind === 'classements') {
    return {
      title: `${name} – Classements`,
      sections: GROUPS.map((g) => ({
        title: `Groupe ${g}`,
        head: ['Pos.', 'Équipe', 'J', 'V', 'N', 'D', 'BP', 'BC', 'Diff', 'Pts'],
        rows: groupStandings(T, g).map((r) => [r.pos, r.team.name, r.j, r.v, r.n, r.d, r.bp, r.bc, r.diff, r.pts]),
      })),
    };
  }
  if (kind === 'buteurs' || kind === 'passeurs') {
    const key = kind === 'buteurs' ? 'goals' : 'assists';
    return {
      title: `${name} – ${kind === 'buteurs' ? 'Buteurs' : 'Passeurs'}`,
      sections: [{ title: '', head: ['Rang', 'Joueur', 'Équipe', kind === 'buteurs' ? 'Buts' : 'Passes décisives'], rows: ranking(ps, key).map((s) => [s.rank, fullName(s.player), s.team?.name || '', s.value]) }],
    };
  }
  if (kind === 'joueurs') {
    return {
      title: `${name} – Joueurs`,
      sections: [{
        title: '',
        head: ['Équipe', 'N°', 'Joueur', 'Poste', 'MJ', 'Buts', 'Passes', 'CJ', 'CR'],
        rows: T.players.map((p) => {
          const s = ps.get(p.id);
          return [T.teamById.get(p.team_id)?.name || '', p.number ?? '', fullName(p), POSITION_LABELS[p.position] || '', s.mj, s.goals, s.assists, s.yellow, s.red];
        }),
      }],
    };
  }
  if (kind === 'equipes') {
    return {
      title: `${name} – Équipes`,
      sections: [{
        title: '',
        head: ['Équipe', 'Groupe', 'Responsable', 'J', 'V', 'N', 'D', 'BP', 'BC', 'CJ', 'CR'],
        rows: T.teams.map((t) => {
          const r = teamRecord(T, t.id);
          return [t.name, t.grp || '', t.coach || '', r.j, r.v, r.n, r.d, r.bp, r.bc, r.yellow, r.red];
        }),
      }],
    };
  }
  if (kind === 'matchs') {
    const st = { scheduled: 'À venir', live: 'En cours', finished: 'Terminé' };
    return {
      title: `${name} – Matchs`,
      sections: [{
        title: '',
        head: ['Date', 'Heure', 'Phase', 'Domicile', 'Score', 'Extérieur', 'Statut', 'Terrain'],
        rows: T.matches.map((m) => [
          fmtDay(m.kickoff), fmtTime(m.kickoff), matchTitle(m), sideName(m, 'home'),
          m.status === 'scheduled' ? '' : `${m.hs} - ${m.as}${m.home_pens != null && m.away_pens != null ? ` (tab ${m.home_pens}-${m.away_pens})` : ''}`,
          sideName(m, 'away'), m.status === 'finished' ? (m.validated ? 'Validé' : 'À valider') : st[m.status], m.venue || '',
        ]),
      }],
    };
  }
  return null;
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toHtml(data, { print }) {
  const body = data.sections
    .map((s) => `${s.title ? `<h2>${esc(s.title)}</h2>` : ''}<table border="1"><thead><tr>${s.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
    .join('\n');
  const style = print
    ? `<style>body{font-family:Arial,sans-serif;color:#161b24;margin:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 6px;color:#1f3f7a}p{color:#5b6676;font-size:12px;margin:0 0 12px}table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:8px}th,td{border:1px solid #b8c2d0;padding:5px 6px;text-align:left}th{background:#2f62b8;color:#fff}tr:nth-child(even) td{background:#f3f5f9}.no{margin-bottom:12px}@media print{.no{display:none}}</style>`
    : '';
  const stamp = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(data.title)}</title>${style}</head><body>${print ? '<button class="no" onclick="window.print()">Imprimer / Enregistrer en PDF</button>' : ''}<h1>${esc(data.title)}</h1><p>Export du ${esc(stamp)}</p>${body}${print ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>' : ''}</body></html>`;
}
