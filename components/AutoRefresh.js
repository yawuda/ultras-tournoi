'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Rafraîchit les données de la page toutes les ~10 secondes (scores quasi en direct).
export default function AutoRefresh({ seconds = 10 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
