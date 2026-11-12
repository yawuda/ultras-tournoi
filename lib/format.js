const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function parts(k) {
  const [d] = String(k || '').split('T');
  const [y, m, dd] = d.split('-').map(Number);
  if (!y || !m || !dd) return null;
  return { y, m, dd, wd: new Date(Date.UTC(y, m - 1, dd)).getUTCDay() };
}
export function fmtDay(k) {
  const p = parts(k);
  return p ? `${DAYS[p.wd]} ${p.dd} ${MONTHS[p.m - 1]}` : 'Date à définir';
}
export function fmtDayLong(k) {
  const p = parts(k);
  return p ? `${DAYS_LONG[p.wd]} ${p.dd} ${MONTHS_LONG[p.m - 1]} ${p.y}` : 'Date à définir';
}
export function fmtTime(k) {
  return String(k || '').split('T')[1] || '';
}
export function fullName(p) {
  if (!p) return 'Joueur inconnu';
  return [p.first_name, p.last_name].filter(Boolean).join(' ');
}
// Nom avec la mention capitaine, pour les listes d'équipe
export function rosterName(p) {
  return p?.is_captain ? `${fullName(p)} (C)` : fullName(p);
}
export function shortName(p) {
  if (!p) return 'Joueur inconnu';
  return p.first_name ? `${p.first_name[0]}. ${p.last_name}` : p.last_name;
}
export function fr(n, digits = 1) {
  return Number(n).toFixed(digits).replace('.', ',');
}

const WD = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const WD_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// "1-20:00,1-22:00" -> "lun 20:00, lun 22:00"
export function slotsToText(str) {
  return String(str || '').split(',').map((s) => /^([0-6])-(\d{2}:\d{2})$/.exec(s.trim())).filter(Boolean).map((m) => `${WD[m[1]]} ${m[2]}`).join(', ');
}
// "lun 20h, lun 22:00, mardi 20:00" -> "1-20:00,1-22:00,2-20:00"
export function textToSlots(text) {
  return String(text || '').split(/[,;\n]+/).map((s) => {
    const m = /^\s*([a-zéû]+)\.?\s+(\d{1,2})\s*[h:]\s*(\d{2})?\s*$/i.exec(s);
    if (!m) return null;
    const wd = WD.indexOf(m[1].toLowerCase().slice(0, 3));
    const hh = Number(m[2]);
    if (wd < 0 || hh > 23) return null;
    return `${wd}-${String(hh).padStart(2, '0')}:${m[3] || '00'}`;
  }).filter(Boolean).join(',');
}
// Regroupe par jour pour l'affichage public : [{ day: 'Lundi', times: ['20:00', '22:00'] }]
export function slotsByDay(str) {
  const out = [];
  for (const s of String(str || '').split(',')) {
    const m = /^([0-6])-(\d{2}:\d{2})$/.exec(s.trim());
    if (!m) continue;
    const day = WD_LONG[m[1]];
    const row = out.find((r) => r.day === day) || (out.push({ day, wd: Number(m[1]) || 7, times: [] }), out[out.length - 1]);
    row.times.push(m[2]);
  }
  return out.sort((a, b) => a.wd - b.wd);
}
