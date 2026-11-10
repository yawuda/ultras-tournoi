import { cache } from 'react';
import { redirect } from 'next/navigation';
import { dbConfigured } from './db.js';
import { loadTournament } from './store.js';

// Vue du tournoi pour les pages publiques (mise en cache quelques secondes).
export const loadT = cache(async () => {
  if (!dbConfigured()) redirect('/installation');
  return loadTournament();
});
// Vue toujours fraîche pour le back-office.
export const loadFresh = cache(async () => {
  if (!dbConfigured()) redirect('/installation');
  return loadTournament({ fresh: true });
});
