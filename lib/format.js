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
export function shortName(p) {
  if (!p) return 'Joueur inconnu';
  return p.first_name ? `${p.first_name[0]}. ${p.last_name}` : p.last_name;
}
export function fr(n, digits = 1) {
  return Number(n).toFixed(digits).replace('.', ',');
}
