'use server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import * as S from '@/lib/store.js';
import { getUser, setSession, clearSession } from '@/lib/session.js';
import { textToSlots } from '@/lib/format.js';

function errMsg(e) {
  if (e instanceof S.AppError) return e.message;
  console.error(e);
  return 'Erreur inattendue, réessayez.';
}
function back(to, e) {
  if (e) unstable_rethrow(e);
  const sep = to.includes('?') ? '&' : '?';
  redirect(e ? `${to}${sep}erreur=${encodeURIComponent(errMsg(e))}` : `${to}${sep}ok=1`);
}
function obj(fd) {
  const o = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string') o[k] = v;
  return o;
}
async function me() {
  const u = await getUser();
  if (!u) redirect('/admin/login');
  return u;
}
function refresh() {
  revalidatePath('/', 'layout');
}

// Envoi d'image : Vercel Blob si configuré, sinon stockage direct en base (petites images).
async function upload(file, prefix) {
  if (!file || typeof file === 'string' || !file.size) return undefined;
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) throw new S.AppError('Format d’image non pris en charge (PNG, JPG, WEBP, SVG).');
  if (file.size > 4 * 1024 * 1024) throw new S.AppError('Image trop lourde (4 Mo maximum).');
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const res = await put(`${prefix}-${Date.now()}.${ext}`, file, { access: 'public', addRandomSuffix: true });
    return res.url;
  }
  if (file.size > 400 * 1024) throw new S.AppError('Sans stockage Vercel Blob, les images sont limitées à 400 Ko.');
  const buf = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buf.toString('base64')}`;
}

// ---------- Connexion ----------
export async function loginAction(fd) {
  let res;
  try {
    res = await S.login({ username: fd.get('username'), password: fd.get('password') });
  } catch (e) {
    back('/admin/login', e);
  }
  await setSession(res.token);
  redirect('/admin');
}
export async function setupAction(fd) {
  try {
    if (fd.get('password') !== fd.get('password2')) throw new S.AppError('Les deux mots de passe ne correspondent pas.');
    await S.createFirstAdmin({ username: fd.get('username'), password: fd.get('password') });
  } catch (e) {
    back('/admin/login', e);
  }
  const res = await S.login({ username: fd.get('username'), password: fd.get('password') });
  await setSession(res.token);
  redirect('/admin');
}
export async function logoutAction() {
  const token = await clearSession();
  await S.logout(token);
  redirect('/admin/login');
}

// ---------- Saisie en direct (appelées depuis l'écran mobile, renvoient un résultat) ----------
async function live(fn) {
  try {
    const u = await me();
    await fn(u);
    refresh();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { error: errMsg(e) };
  }
}
export async function liveAddEvent(d) {
  return live((u) => S.addEvent(u, d));
}
export async function liveUpdateEvent(d) {
  return live((u) => S.updateEvent(u, d));
}
export async function liveDeleteEvent(id) {
  return live((u) => S.deleteEvent(u, id));
}
export async function liveStart(id) {
  return live((u) => S.startMatch(u, id));
}
export async function livePeriod(id, period) {
  return live((u) => S.setPeriod(u, id, period));
}
export async function livePens(id, h, a) {
  return live((u) => S.setPens(u, id, h, a));
}
export async function liveFinish(id) {
  return live((u) => S.finishMatch(u, id));
}
export async function liveValidate(id) {
  return live((u) => S.validateMatch(u, id));
}
export async function liveUnvalidate(id) {
  return live((u) => S.unvalidateMatch(u, id));
}
export async function liveLineup(d) {
  return live((u) => S.setLineup(u, d));
}

// ---------- Formulaires du back-office ----------
export async function saveTeamAction(fd) {
  const to = String(fd.get('back') || '/admin/equipes');
  try {
    const u = await me();
    const d = obj(fd);
    const logo = await upload(fd.get('logo'), 'logo');
    if (logo) d.logo_url = logo;
    else if (fd.get('remove_logo')) d.logo_url = '';
    else delete d.logo_url;
    await S.saveTeam(u, d);
    refresh();
  } catch (e) {
    back(to, e);
  }
  back(to);
}
export async function deleteTeamAction(fd) {
  try {
    await S.deleteTeam(await me(), fd.get('id'));
    refresh();
  } catch (e) {
    back('/admin/equipes', e);
  }
  back('/admin/equipes');
}
export async function savePlayerAction(fd) {
  const to = String(fd.get('back') || '/admin/joueurs');
  try {
    const u = await me();
    const d = obj(fd);
    const photo = await upload(fd.get('photo'), 'joueur');
    if (photo) d.photo_url = photo;
    else if (fd.get('remove_photo')) d.photo_url = '';
    else delete d.photo_url;
    await S.savePlayer(u, d);
    refresh();
  } catch (e) {
    back(to, e);
  }
  back(to);
}
export async function deletePlayerAction(fd) {
  const to = String(fd.get('back') || '/admin/joueurs');
  try {
    await S.deletePlayer(await me(), fd.get('id'));
    refresh();
  } catch (e) {
    back(to, e);
  }
  back(to);
}
export async function saveMatchAction(fd) {
  const to = String(fd.get('back') || '/admin/matchs');
  try {
    const d = obj(fd);
    d.kickoff = d.date && d.time ? `${d.date}T${d.time}` : '';
    if (d.keep_teams) {
      delete d.home_id;
      delete d.away_id;
    }
    await S.saveMatch(await me(), d);
    refresh();
  } catch (e) {
    back(to, e);
  }
  back(to);
}
export async function deleteMatchAction(fd) {
  try {
    await S.deleteMatch(await me(), fd.get('id'));
    refresh();
  } catch (e) {
    back('/admin/matchs', e);
  }
  back('/admin/matchs');
}
export async function resetMatchAction(fd) {
  const id = fd.get('id');
  try {
    await S.resetMatch(await me(), id);
    refresh();
  } catch (e) {
    back(`/admin/matchs/${id}`, e);
  }
  back(`/admin/matchs/${id}`);
}
export async function createUserAction(fd) {
  try {
    await S.createUser(await me(), obj(fd));
  } catch (e) {
    back('/admin/comptes', e);
  }
  back('/admin/comptes');
}
export async function deleteUserAction(fd) {
  try {
    await S.deleteUser(await me(), fd.get('id'));
  } catch (e) {
    back('/admin/comptes', e);
  }
  back('/admin/comptes');
}
export async function passwordAction(fd) {
  try {
    await S.setPassword(await me(), obj(fd));
  } catch (e) {
    back('/admin/comptes', e);
  }
  back('/admin/comptes');
}
export async function settingsAction(fd) {
  try {
    const u = await me();
    const d = obj(fd);
    d.tiebreakers = fd.getAll('tb').filter(Boolean).join(',');
    if (d.slots_text !== undefined) d.slots = textToSlots(d.slots_text);
    d.manual_order = JSON.stringify({ A: d.mo_A || '', B: d.mo_B || '', C: d.mo_C || '', D: d.mo_D || '' });
    const banner = await upload(fd.get('banner'), 'banniere');
    if (banner) d.banner_url = banner;
    else if (fd.get('remove_banner')) d.banner_url = '';
    else delete d.banner_url;
    const logo = await upload(fd.get('logo'), 'logo-tournoi');
    if (logo) d.logo_url = logo;
    else if (fd.get('remove_logo')) d.logo_url = '';
    else delete d.logo_url;
    await S.saveSettings(u, d);
    refresh();
  } catch (e) {
    back('/admin/parametres', e);
  }
  back('/admin/parametres');
}
export async function clearDemoAction() {
  try {
    await S.clearDemoResults(await me());
    refresh();
  } catch (e) {
    back('/admin/parametres', e);
  }
  back('/admin/parametres');
}
export async function regenerateDemoAction() {
  try {
    await S.regenerateDemo(await me());
    refresh();
  } catch (e) {
    back('/admin/parametres', e);
  }
  back('/admin/parametres');
}
export async function rebuildScheduleAction() {
  try {
    await S.rebuildSchedule(await me());
    refresh();
  } catch (e) {
    back('/admin/parametres', e);
  }
  back('/admin/parametres');
}
