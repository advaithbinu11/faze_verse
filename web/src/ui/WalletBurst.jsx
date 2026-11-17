import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { pointsGain } from '../data/pointsGain.js';

const SHOW_MS = 2800;
// Where each coin starts, relative to the wallet (px). They stream in from all around and drop into its slot.
const COINS = [[-96, -64], [-70, -92], [0, -104], [72, -90], [100, -58], [-104, -20], [104, -14], [-40, -112]];

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const coinsFor = (n) => Math.min(COINS.length, 3 + Math.floor(Math.log10(Math.max(n, 1)) * 2));

// Counts up from 0 to the target. Reduced motion shows the final number straight away.
function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(calm() || target <= 10 ? target : 0);
  useEffect(() => {
    if (calm() || target <= 10) { setValue(target); return undefined; }
    let raf; const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function Wallet({ amount, coins }) {
  const shown = useCountUp(amount);
  return (
    <div className="wallet-burst frame" data-theme="dark" aria-hidden="true">
      <div className="wb-stage">
        <svg className="wb-wallet" viewBox="0 0 120 92" width="84" height="64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
          <defs><clipPath id="wb-clip"><rect x="8" y="20" width="104" height="64" rx="10" /></clipPath></defs>
          <rect x="8" y="20" width="104" height="64" rx="10" />
          <path className="wb-slot" d="M22 20h60" strokeLinecap="round" />
          <rect x="82" y="42" width="30" height="22" rx="6" />
          <circle cx="94" cy="53" r="3" fill="currentColor" stroke="none" />
          <path d="M20 40h30M20 52h18M20 64h24" strokeWidth="1.4" opacity=".55" strokeLinecap="round" />
          <g clipPath="url(#wb-clip)"><rect className="wb-scan" x="8" y="20" width="104" height="4" fill="var(--color-accent)" stroke="none" /></g>
        </svg>
        <span className="wb-ring" />
        {COINS.slice(0, coins).map(([x, y], i) => <span key={i} className="wb-coin" style={{ '--sx': `${x}px`, '--sy': `${y}px`, '--d': `${i * 90}ms` }} />)}
      </div>
      <div className="wb-amount">
        <span className="wb-num">+{shown.toLocaleString()}</span>
        <span className="wb-unit">FaZe Points</span>
      </div>
    </div>
  );
}

// A wallet that swallows a stream of coins and shows what you earned, every time the balance goes up, whatever the
// source (post bonus, watch time, shorts, a merch order, a prize). A persistent live region announces it for screen readers.
// Gains that land while it is showing are added together so it never stacks or flickers.
export default function WalletBurst() {
  const { user } = useAuth();
  const last = useRef(null);
  const timer = useRef(0);
  const [burst, setBurst] = useState(null); // { id, amount }
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!user) { last.current = null; return; }
    const gain = pointsGain(last.current, user);
    last.current = { id: user._id, points: user.faze_points };
    if (!gain) return;
    setBurst((b) => ({ id: (b?.id ?? 0) + 1, amount: (b?.amount ?? 0) + gain }));
    setNote(`You earned ${gain.toLocaleString()} FaZe Points.`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setBurst(null); setNote(''); }, SHOW_MS);
  }, [user?._id, user?.faze_points]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <p role="status" className="sr-only">{note}</p>
      {burst && <Wallet key={burst.id} amount={burst.amount} coins={coinsFor(burst.amount)} />}
    </>
  );
}
