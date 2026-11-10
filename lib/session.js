import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { dbConfigured } from './db.js';
import { userFromToken } from './store.js';

const COOKIE = 'ut_session';

export const getUser = cache(async () => {
  if (!dbConfigured()) return null;
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  return token ? userFromToken(token) : null;
});
export async function requireUser(roles) {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  if (roles && !roles.includes(user.role)) redirect('/admin?erreur=' + encodeURIComponent('Accès réservé.'));
  return user;
}
export async function setSession(token) {
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 14 * 86400 });
}
export async function clearSession() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  c.delete(COOKIE);
  return token;
}
