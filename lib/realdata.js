// Données réelles du tournoi (équipes confirmées) et calendrier sur les créneaux hebdomadaires.
// Les équipes non encore confirmées sont des places « Équipe 10 » à « Équipe 16 »,
// à renommer et compléter dans le back-office au fur et à mesure.

export const START_DATE = '2026-11-16';
// Créneaux hebdomadaires : jour (1 = lundi … 6 = samedi, 0 = dimanche) et heure de début.
export const WEEKLY_SLOTS = '1-20:00,1-22:00,2-20:00,3-22:00,6-22:00';
export const VENUE = 'Terrain Ultras';

const G = 'G';
// [nom, abréviation, couleur, joueurs]. Un joueur suivi de G est gardien.
export const TEAMS = [
  ['Sunrise Team', 'SUN', '#C2410C', [['Mahdi Al Shab', 'C'], 'Hassan Ayoub', 'Hassan Darwich', 'Hussein Darwich', 'Abbas Mcheik', 'Abbas Wehbe', 'Bilal Fawaz', 'Mohammad Hotait', 'Ali Mzeihem', 'Sleiman Hakim', 'Mohamad Ghamloush', ['Eritier', G]]],
  ['Taste Life', 'TL', '#047857', [['Abo Hamoud', 'C'], 'Zein Hamoud', 'Amin Haloud', 'Hasan Hamoud', 'Mahmoud Shemali', 'Wisam Mkana', 'Kasem Hamede', 'Marcel', 'Dorsale', 'Tshitsha', 'Bahar', 'Zahwi', 'Mahamat']],
  ['Star Group', 'SG', '#1D4ED8', [['Yahye (Yaaya)', 'C'], 'Abdifitax', 'Lam John Bedit', 'Ali', 'Mouscab', 'Falli', 'Janny', 'Rezah', 'Mohamed Isse', 'Kabongo Tshilumba', ['Gabriel', G]]],
  ['G.M.K', 'GMK', '#7C3AED', [['Mahdi Akkash', 'C'], 'Abo Jaafar Akkash', 'Jawad', 'Ayman', 'Masre', 'Nahas', 'Ali Sleiman', 'Mahmoud', 'Fontas', 'Fontas 2', 'Hussein Haj Ali', 'Ali Tfayle', ['Dany', G]]],
  ['Le Centre', 'LC', '#0E7490', [['Ali Bourgi', 'C'], 'Ahmad Bourgi', 'Merlin', 'Mardoche Liwanga', 'Adel Karim', 'Jad Achour', 'Iyad Achour', 'Hassan Attie', 'JK Hernandez', 'Bastien', 'Alvine Hernandez', ['Bobo', G]]],
  ['Panthers Team', 'PAN', '#334155', ['Benji', ['Michael', 'C'], 'Joel', 'Auguy', 'Christian', 'Pacifique', 'Olivier', 'Plamedi', 'Alex', 'Manu', ['Shekinah', G], 'Jason', 'Dan', 'Ahmed']],
  ['Smart Construction', 'SMC', '#92400E', [['Mohamed Hamam', 'C'], 'Abdoul Gensh', 'Loay Hamam', 'Ebrahem Kamal', 'Kamal Kamal', 'Eltayeb', 'Mohamed Elsayed', 'Mostafa Sasa', 'Abdoul', 'Ahmed Mansour', 'Issac', 'Jonathan']],
  ['Nsarieh', 'NSA', '#4D7C0F', [['Ali Farhat', 'C'], 'Ali Rahhal', 'Mohamad Fakih', 'Ahmad Nasser', 'Brahim Yassin', 'Ali Wazne', 'Hassan Khalife', 'Hussin Kerdi', 'Iskandar', 'Hassan Fakih', ['Abada', G]]],
  ['Espérance de Tunis', 'EST', '#B91C1C', [['Khaled Sayed Fathy', G], ['Seifedine Hedhli', 'C'], 'Ahmed Ferig Abdalla Bakoush', 'Bassem Ben Mahmoud', 'Heni Derouich', 'Rabie Ammouri', 'Hamza Chebbi', 'Alessandro Perrone', 'Wajdi Gnoumi', 'Safwen Karray', 'Moez Garzoun', 'Adem Bahri', 'Majdi Hasni']],
  ['Aigle', 'AIG', '#A16207', [['Abdalah Ach', 'C'], 'Hassan Alex', 'Mahdi Tarhini', 'Issa Dak', 'Amir Ezzedine', 'Ibrahim Jeber', 'Quentin Henry', 'Winner Eboma', 'Ali Diab', 'Exauce Lomeya', 'Mohamed Fawaz', 'Luqman Saf', ['Hugo', G]]],
  ['Z Team', 'ZT', '#111827', [['Hussein', 'C'], 'Yawuda', 'Alex Mokeni', 'Roland', 'Branverli', 'Jordan', 'Alex NS', 'Alilo', 'Guelor', 'Anthony NS', ['Matta', G]]],
  ['Bokutani', 'BOK', '#9D174D', [['Big', 'C'], 'Manu', 'Obed', 'Joel Ntela', 'Tshibangu', 'Danias', 'Jean Mari', 'Ya Djo', 'Mr Femy', 'Miradi', 'Tony', 'Eric', 'Olmo', 'Badjo']],
];
// Équipes ajoutées après la mise en production (migration v3 : remplacent « Équipe 10 » et « Équipe 11 »).
export const ADDED_V3 = [9, 10];
export const ADDED_V5 = [11]; // Bokutani remplace « Équipe 12 » (groupe D)
// v4 : capitaines de toutes les équipes, effectif de l'Espérance de Tunis mis à jour.
export const CAPTAINS_V4 = [['SUN', 'Mahdi Al Shab'], ['TL', 'Abo Hamoud'], ['SG', 'Yahye (Yaaya)'], ['GMK', 'Mahdi Akkash'], ['LC', 'Ali Bourgi'], ['PAN', 'Michael'], ['SMC', 'Mohamed Hamam'], ['NSA', 'Ali Farhat'], ['EST', 'Seifedine Hedhli'], ['AIG', 'Abdalah Ach'], ['ZT', 'Hussein']];
export const CAPTAINS_V3 = [['GMK', 'Mahdi', 'Akkash'], ['EST', 'Seifedine', 'Hedhli']];
const PLACEHOLDER_COLORS = ['#475569', '#64748B', '#52525B', '#57534E', '#4B5563', '#5B6676', '#3F3F46'];
// Répartition « en serpentin » : chaque groupe reçoit au moins 2 équipes confirmées.
const GROUP_OF = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];

export const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

export function splitName(full) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1 || /\(/.test(full) || /^\S+ \d+$/.test(full)) return { first_name: null, last_name: full.trim() };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export function parseSlots(str) {
  return String(str || WEEKLY_SLOTS)
    .split(',')
    .map((s) => /^([0-6])-(\d{2}:\d{2})$/.exec(s.trim()))
    .filter(Boolean)
    .map((m) => ({ wd: Number(m[1]), time: m[2] }))
    .sort((a, b) => ((a.wd || 7) - (b.wd || 7)) || a.time.localeCompare(b.time));
}

// Liste des n prochains créneaux à partir d'une date (incluse).
export function slotKickoffs(start, slotsStr, n) {
  const slots = parseSlots(slotsStr);
  if (!slots.length) throw new Error('Aucun créneau valide');
  const [y, m, d] = start.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d);
  const out = [];
  while (out.length < n) {
    const day = new Date(t);
    const wd = day.getUTCDay();
    for (const s of slots) if (s.wd === wd && out.length < n) out.push(`${day.toISOString().slice(0, 10)}T${s.time}`);
    t += 86400000;
  }
  return out;
}

// Ordre des matchs : journée par journée ; dans une journée, les affiches entre équipes confirmées d'abord.
export function groupFixtures(teams) {
  const isPlaceholder = (id) => !!teams.find((t) => t.id === id)?.placeholder;
  const fixtures = [];
  for (let r = 0; r < 3; r++) {
    const round = [];
    for (const g of ['A', 'B', 'C', 'D']) {
      const ids = teams.filter((t) => t.grp === g).sort((a, b) => a.id - b.id).map((t) => t.id);
      if (ids.length < 4) continue;
      PAIRINGS[r].forEach(([h, a], i) => round.push({ grp: g, round: r + 1, code: `${g}${r * 2 + i + 1}`, home_id: ids[h], away_id: ids[a], order: round.length }));
    }
    const weight = (f) => (isPlaceholder(f.home_id) ? 1 : 0) + (isPlaceholder(f.away_id) ? 1 : 0);
    round.sort((x, y) => weight(x) - weight(y) || x.order - y.order);
    fixtures.push(...round);
  }
  return fixtures;
}

export const KNOCKOUT = [
  ['qf', 'QF1', '1A', '2B'],
  ['qf', 'QF2', '1B', '2A'],
  ['qf', 'QF3', '1C', '2D'],
  ['qf', 'QF4', '1D', '2C'],
  ['sf', 'DF1', 'W:QF1', 'W:QF3'],
  ['sf', 'DF2', 'W:QF2', 'W:QF4'],
  ['third', '3P', 'L:DF1', 'L:DF2'],
  ['final', 'F', 'W:DF1', 'W:DF2'],
];

export function buildSchedule(teams, { start = START_DATE, slots = WEEKLY_SLOTS, venue = VENUE } = {}) {
  const fixtures = groupFixtures(teams);
  const kicks = slotKickoffs(start, slots, fixtures.length + KNOCKOUT.length);
  const base = { status: 'scheduled', validated: false, period: '', period_started_at: null, started_at: null, ended_at: null, home_pens: null, away_pens: null, manager_id: null, is_demo: false, venue };
  const matches = fixtures.map((f, i) => ({ ...base, id: i + 1, phase: 'group', grp: f.grp, round: f.round, code: f.code, kickoff: kicks[i], home_id: f.home_id, away_id: f.away_id, home_src: null, away_src: null }));
  KNOCKOUT.forEach(([phase, code, hs, as], i) => {
    matches.push({ ...base, id: matches.length + 1, phase, grp: null, round: null, code, kickoff: kicks[fixtures.length + i], home_id: null, away_id: null, home_src: hs, away_src: as });
  });
  return matches;
}

export function buildReal() {
  const teams = [];
  const players = [];
  let pid = 1;
  for (let i = 0; i < 16; i++) {
    const def = TEAMS[i];
    const id = i + 1;
    if (def) {
      teams.push({ id, name: def[0], short: def[1], grp: GROUP_OF[i], coach: null, logo_url: null, color: def[2] });
      for (const entry of def[3]) {
        const [name, flag] = Array.isArray(entry) ? entry : [entry, null];
        players.push({ id: pid++, team_id: id, ...splitName(name), number: null, position: flag === G ? G : null, is_captain: flag === 'C', photo_url: null });
      }
    } else {
      teams.push({ id, name: `Équipe ${id}`, short: `E${id}`, grp: GROUP_OF[i], coach: null, logo_url: null, color: PLACEHOLDER_COLORS[i - TEAMS.length] || '#5B6676', placeholder: true });
    }
  }
  const matches = buildSchedule(teams);
  const settings = {
    name: 'Ultras Tournoi',
    subtitle: 'Football 8 contre 8',
    venue: VENUE,
    half_minutes: '25',
    et_minutes: '10',
    yellow_suspension: '3',
    tiebreakers: JSON.stringify(['points', 'diff', 'goals', 'h2h', 'fairplay']),
    manual_order: '{}',
    start_date: START_DATE,
    slots: WEEKLY_SLOTS,
    demo: '0',
    data_version: '5',
  };
  return { settings, teams: teams.map(({ placeholder, ...t }) => t), players, matches, events: [], lineups: [] };
}
