'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS = {
  home: 'M3 11l9-8 9 8v10h-6v-6H9v6H3z',
  cal: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  list: 'M4 6h16M4 12h16M4 18h10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  bars: 'M5 20V10M12 20V4M19 20v-7',
};
const LINKS = [
  ['/', 'Accueil', 'home'],
  ['/matchs', 'Matchs', 'cal'],
  ['/classements', 'Classements', 'list'],
  ['/equipes', 'Équipes', 'shield'],
  ['/joueurs', 'Joueurs', 'user'],
  ['/statistiques', 'Stats', 'bars'],
];

export default function Nav() {
  const path = usePathname() || '/';
  return (
    <nav className="nav" aria-label="Navigation principale">
      {LINKS.map(([href, label, icon]) => {
        const on = href === '/' ? path === '/' : path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[icon]} />
            </svg>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
