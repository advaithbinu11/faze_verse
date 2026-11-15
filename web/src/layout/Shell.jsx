import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Button, Chip, buttonStyles } from '../ui/primitives.jsx';
import { useAuth } from '../state/AuthContext.jsx';

const NAV = [
  ['/', 'Home'], ['/welcome', 'Welcome'], ['/live', 'Live'], ['/feed', 'Feed'], ['/party', 'Party up'],
  ['/create', 'Create'], ['/arcade', 'Arcade'], ['/rewards', 'Rewards'], ['/merch', 'Merch'], ['/profile', 'Profile'],
];

function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('fv_theme'); } catch { return null; } });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem('fv_theme', theme) : localStorage.removeItem('fv_theme'); } catch { /* storage blocked */ }
  }, [theme]);
  const isDark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')];
}

export default function Shell() {
  const { user, status, demo, logout } = useAuth();
  const [isDark, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }, [pathname]);

  return (
    <div className="pb-12">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-bg focus:p-2">Skip to content</a>
      <header className="gutter flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5 border-b-4 border-text py-4">
        <Link to="/" className="font-display text-[26px] uppercase leading-none">Faze <span className="text-accent-text">Vault</span></Link>
        <div className="flex flex-wrap items-center gap-1.5">
          {demo && <Chip on={false}>Demo data</Chip>}
          {user && <Chip accent><span aria-live="off">{user.faze_points.toLocaleString()}</span> Points</Chip>}
          {status !== 'loading' && (user
            ? <Button onClick={logout}>Sign out</Button>
            : <><Link to="/login" className={buttonStyles()}>Sign in</Link><Link to="/signup" className={buttonStyles('primary')}>Sign up</Link></>)}
          <Button aria-pressed={isDark} onClick={toggleTheme}>{isDark ? 'Light' : 'Dark'} mode</Button>
        </div>
      </header>

      <nav aria-label="Main" className="gutter mb-6 overflow-x-auto border-b border-border">
        <ul className="m-0 flex list-none gap-1 p-0">
          {NAV.map(([to, label]) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `block whitespace-nowrap border-b-4 px-4 py-2.5 text-base font-bold ${isActive ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'}`}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main" tabIndex={-1} className="gutter outline-none"><Outlet /></main>

      <footer className="gutter mt-9 border-t border-border pt-3.5 text-[13px] text-muted">
        Unofficial fan project in development. Points have no cash value. 13+ only; no private messages in parties.
      </footer>
    </div>
  );
}
