import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Button, EmptyState, ErrorState, Skeleton, buttonStyles, errorMessage } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const DWELL_MS = 3000; // a short counts after this long on screen
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function Heart({ filled }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12c-2.5 4.65-9.5 9-9.5 9z" />
    </svg>
  );
}

// Five dots that fill as you watch; the fifth pays out.
function Progress({ progress }) {
  const done = progress.viewed % progress.batch_size;
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between gap-3 border-b border-border bg-bg px-1 py-3" role="status">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: progress.batch_size }, (_, i) => (
          <span key={i} className={`h-2.5 w-7 rounded-full transition-colors duration-fast ${i < done ? 'bg-accent' : 'bg-border-input'}`} />
        ))}
      </div>
      <p className="m-0 text-sm">
        <span className="font-bold">{progress.next_reward_in} more</span>
        <span className="text-muted"> {progress.next_reward_in === 1 ? 'short' : 'shorts'} for </span>
        <span className="font-bold text-accent-text">+{progress.points} points</span>
      </p>
    </div>
  );
}

function ShortCard({ short, onViewed, onLike }) {
  const ref = useRef(null);
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    let timer;
    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.intersectionRatio >= 0.6;
      setPlaying(visible && !reducedMotion());
      clearTimeout(timer);
      if (visible && !short.seen) timer = setTimeout(() => onViewed(short.id), DWELL_MS);
    }, { threshold: [0, 0.6] });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [short.id, short.seen, onViewed]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => {}); else v.pause();
  }, [playing]);

  return (
    <article ref={ref} className="mb-8 border border-border bg-bg" aria-label={short.title}>
      <header className="flex items-center gap-3 p-3">
        <Avatar name={short.creator} size={36} />
        <div className="min-w-0 grow leading-tight">
          <div className="truncate text-sm font-bold">{short.creator}</div>
          <div className="truncate text-[13px] text-muted">{short.game} · {short.posted}</div>
        </div>
        {short.seen && <span className="label">Watched</span>}
      </header>

      <a href={short.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[9/14] w-full overflow-hidden bg-surface" aria-label={`Open "${short.title}" on ${short.platform}`}>
        {short.thumb && <img src={short.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        {short.preview && <video ref={video} src={short.preview} muted loop playsInline preload="none" poster={short.thumb ?? undefined} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-fast ${playing ? 'opacity-100' : 'opacity-0'}`} />}
        {short.duration && <span className="absolute bottom-2 right-2 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-xs text-white">{short.duration}</span>}
      </a>

      <div className="grid gap-1.5 p-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onLike(short.id)} aria-pressed={short.liked} aria-label={short.liked ? 'Unlike' : 'Like'}
            className={`-ml-1 grid min-h-[40px] min-w-[40px] place-items-center ${short.liked ? 'text-accent-text' : 'text-text'}`}>
            <Heart filled={short.liked} />
          </button>
          <a href={short.url} target="_blank" rel="noopener noreferrer" className={buttonStyles('secondary', 'ml-auto')}>Watch on {short.platform === 'x' ? 'X' : short.platform[0].toUpperCase() + short.platform.slice(1)}</a>
        </div>
        <div className="text-sm font-bold">{short.like_count.toLocaleString()} {short.like_count === 1 ? 'like' : 'likes'}</div>
        <p className="m-0 break-words text-body-sm"><span className="font-bold">{short.creator}</span> {short.title}</p>
        {short.reasons.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[13px] text-muted">
            {short.reasons.map((r) => <li key={r.kind}>{r.text}</li>)}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function Shorts() {
  const { user, status, login, refresh } = useAuth();
  const toast = useToast();
  const feed = useAsync(() => (user ? api.getShortsFeed() : null), [user?._id]);
  const [shorts, setShorts] = useState([]);
  const [progress, setProgress] = useState(null);
  const counted = useRef(new Set()); // ids already sent this visit, so a card re-entering the viewport does not re-post

  useEffect(() => {
    if (!feed.data) return;
    setShorts(feed.data.shorts);
    setProgress(feed.data.progress);
    counted.current = new Set();
  }, [feed.data]);

  const patch = (id, change) => setShorts((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));

  // Stable identity: cards re-subscribe their observer when this changes, which would reset the dwell timer on every re-render.
  const viewHandler = useRef();
  const onViewed = useCallback((id) => viewHandler.current(id), []);
  viewHandler.current = async (id) => {
    if (counted.current.has(id)) return;
    counted.current.add(id);
    try {
      const r = await api.viewShort(id);
      setProgress(r.progress);
      patch(id, { seen: true });
      if (r.awarded) { toast(`+${r.awarded} points for watching ${r.progress.batch_size} shorts.`); refresh(); }
    } catch (e) {
      counted.current.delete(id); // 429 or a network blip: let the next dwell retry
      if (e.status !== 429) toast(errorMessage(e), 'error');
    }
  };

  const onLike = async (id) => {
    try {
      const r = await api.likeShort(id);
      patch(id, { liked: r.liked, like_count: r.like_count });
    } catch (e) { toast(errorMessage(e), 'error'); }
  };

  return (
    <div className="mx-auto max-w-[470px]">
      <h1 className="text-xl">Shorts</h1>
      <p className="mb-3 text-body-sm text-muted">Picked from the games and players you follow, plus what your friends play and like. Every 5 shorts you watch earns 10 points.</p>

      {status === 'loading' || (user && feed.loading && !shorts.length) ? (
        <div className="grid gap-4"><Skeleton className="h-[560px]" /><Skeleton className="h-[560px]" /></div>
      ) : !user ? (
        <EmptyState title="Sign in for your shorts" body="Your feed is built from your games and friends, and the points need an account to land in." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} />
      ) : feed.error ? (
        <ErrorState error={feed.error} onRetry={feed.reload} />
      ) : !shorts.length ? (
        <EmptyState title="No shorts yet" body="Check back soon. New FaZe shorts are added regularly." />
      ) : (
        <>
          {progress && <Progress progress={progress} />}
          {shorts.map((s) => <ShortCard key={s.id} short={s} onViewed={onViewed} onLike={onLike} />)}
          <p className="label mb-8 text-center">You are all caught up</p>
        </>
      )}
    </div>
  );
}
