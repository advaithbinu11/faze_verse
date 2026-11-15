import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, inputClass } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useReducedMotion } from '../hooks/useEnv.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const CHANNELS = [
  { c: 'faze', n: 'FaZe', d: 'Official FaZe channel' },
  { c: 'rainbow6', n: 'Rainbow Six Esports', d: 'Official R6 esports broadcast' },
  { c: 'rainbow6bravo', n: 'R6 Esports Bravo', d: 'Second R6 esports stream' },
  { c: 'hcs', n: 'Halo Championship Series', d: 'Official Halo esports broadcast' },
];
const REACTIONS = ['🔥', '😂', '👏', '🏆', '😮'];
const LOGIN = /^[a-z0-9_]{3,25}$/;
const STATUS = { connecting: 'Connecting', live: 'Live', offline: 'Offline', replay: 'Replay' };
const BEAT_MS = 15_000;
const IDLE_MS = 10 * 60_000;

// Per-device storage: wrapped because it can throw (private windows, blocked site data).
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* the page still works without it */ } };

let apiPromise;
const loadTwitch = () => (apiPromise ??= new Promise((resolve, reject) => {
  if (window.Twitch?.Player) return resolve(window.Twitch);
  const s = document.createElement('script');
  s.src = 'https://player.twitch.tv/js/embed/v1.js';
  s.onload = () => resolve(window.Twitch);
  s.onerror = () => { apiPromise = undefined; reject(new Error('Could not load the Twitch player.')); };
  document.head.appendChild(s);
}));

const darkMode = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};

function Player({ channel, video, onStatus, onPlaying }) {
  const host = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let dead = false;
    setError('');
    onStatus(video ? 'replay' : 'connecting');
    onPlaying(false);
    loadTwitch().then((Twitch) => {
      if (dead) return;
      host.current.innerHTML = '';
      const player = new Twitch.Player(host.current, { ...(video ? { video: `v${video}` } : { channel }), parent: [location.hostname], width: '100%', height: '100%', autoplay: true, muted: false });
      const E = Twitch.Player;
      // Only a PLAYING report counts toward points; pausing, buffering, ending or going offline stops them.
      player.addEventListener(E.PLAYING, () => { if (!video) onStatus('live'); onPlaying(true); });
      player.addEventListener(E.PAUSE, () => onPlaying(false));
      player.addEventListener(E.ENDED, () => onPlaying(false));
      if (!video) {
        player.addEventListener(E.ONLINE, () => onStatus('live'));
        player.addEventListener(E.OFFLINE, () => { onStatus('offline'); onPlaying(false); });
      }
    }).catch((e) => { if (!dead) { setError(e.message); onStatus(''); } });
    return () => { dead = true; if (host.current) host.current.innerHTML = ''; };
  }, [channel, video]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative aspect-video overflow-hidden rounded-md bg-black lg:aspect-auto lg:h-[var(--watch-h)]">
      <div ref={host} className="h-full w-full" />
      {error && <p role="alert" className="absolute inset-0 m-0 grid place-items-center p-4 text-center text-sm text-white">{error} Check your connection and try again.</p>}
    </div>
  );
}

function Comments({ channel }) {
  const { user } = useAuth();
  const key = `fv_tw_comments_${channel}`;
  const [list, setList] = useState(() => read(key, []));
  const [text, setText] = useState('');
  useEffect(() => { setList(read(key, [])); }, [key]);

  const post = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const next = [{ n: user?.name ?? 'You', color: user?.profile_color, t }, ...list].slice(0, 50);
    setList(next); write(key, next); setText('');
  };

  return (
    <div className="grid gap-3">
      <form onSubmit={post} className="flex gap-2">
        <input className={`${inputClass} grow`} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Add a comment" />
        <Button variant="primary" type="submit">Post</Button>
      </form>
      {list.length === 0
        ? <p className="m-0 text-body-sm text-muted">No comments on this stream yet.</p>
        : <ul className="m-0 grid max-h-[min(320px,45dvh)] list-none lg:max-h-[calc(var(--watch-h)-8rem)] gap-2 overflow-auto p-0">
            {list.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-body-sm">
                <Avatar name={c.n} color={c.color ?? undefined} size={28} />
                <span className="min-w-0 break-words"><b>{c.n}</b> {c.t}</span>
              </li>
            ))}
          </ul>}
      <p className="m-0 text-[13px] text-muted">Vault comments are saved on this device only.</p>
    </div>
  );
}

export function TwitchWatch() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(null);
  const [points, setPoints] = useState(null);
  const playing = useRef(false);
  const lastActive = useRef(Date.now());
  const [custom, setCustom] = useState(() => read('fv_tw', []));
  const [current, setCurrent] = useState('faze');
  const [status, setStatus] = useState('');
  const [pane, setPane] = useState('chat');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const burst = useRef(null);

  const all = [...CHANNELS, ...custom.map((c) => ({ c, n: c, d: 'Added by you', mine: true }))];
  const ch = all.find((x) => x.c === current) ?? all[0];

  // A channel that is offline plays its latest past broadcast instead of a blank player.
  useEffect(() => { setReplay(null); }, [ch.c]);
  useEffect(() => {
    if (status !== 'offline' || replay || !api.getTwitchLatestVideo) return;
    let dead = false;
    api.getTwitchLatestVideo(ch.c).then((v) => { if (!dead) setReplay(v); }).catch(() => {});
    return () => { dead = true; };
  }, [status, ch.c]); // eslint-disable-line react-hooks/exhaustive-deps

  // Points: tell the server whether a player is playing and the viewer is here; the server measures the time.
  useEffect(() => {
    if (!user || !api.twitchBeat) return;
    const bump = () => { lastActive.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'mousemove'];
    events.forEach((n) => document.addEventListener(n, bump, { passive: true, capture: true }));
    // Clicks inside the player iframe never reach the page, but they do move focus to the iframe.
    const onBlur = () => setTimeout(() => { if (document.activeElement?.tagName === 'IFRAME') bump(); }, 0);
    window.addEventListener('blur', onBlur);
    const beat = async () => {
      const here = document.visibilityState === 'visible' && Date.now() - lastActive.current <= IDLE_MS;
      try {
        const r = await api.twitchBeat({ playing: playing.current && here });
        setPoints(r);
        if (r.awarded) refresh();
      } catch { /* a missed beat only delays points */ }
    };
    const t = setInterval(beat, BEAT_MS);
    return () => { clearInterval(t); events.forEach((n) => document.removeEventListener(n, bump, { capture: true })); window.removeEventListener('blur', onBlur); };
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCustom = (next) => { setCustom(next); write('fv_tw', next); };
  const add = (e) => {
    e.preventDefault();
    const v = name.trim();
    const login = (v.match(/twitch\.tv\/([A-Za-z0-9_]{3,25})/i)?.[1] ?? v).toLowerCase();
    if (!LOGIN.test(login)) return toast('Type a Twitch username, like faze', 'error');
    if (!all.some((x) => x.c === login)) saveCustom([...custom, login]);
    setName(''); setAdding(false); setCurrent(login);
  };
  const remove = (c) => { saveCustom(custom.filter((x) => x !== c)); if (current === c) setCurrent('faze'); };

  const react = (emoji) => {
    if (reduced || !burst.current) return;
    const el = document.createElement('span');
    el.textContent = emoji;
    Object.assign(el.style, { position: 'absolute', bottom: '0', left: `${10 + Math.random() * 80}%`, fontSize: '28px', pointerEvents: 'none' });
    burst.current.appendChild(el);
    el.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-140px)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).onfinish = () => el.remove();
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}#watch=${ch.c}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Watch on FaZe Vault', url });
      else { await navigator.clipboard.writeText(url); toast('Link copied'); }
    } catch { /* share sheet dismissed */ }
  };

  // Opens a shared #watch=<channel> link on that stream.
  useEffect(() => {
    const m = location.hash.match(/^#watch=([A-Za-z0-9_]{3,25})$/);
    if (m) setCurrent(m[1].toLowerCase());
  }, []);

  return (
    <section aria-labelledby="tw-h" className="grid gap-4" style={{ '--watch-h': 'max(340px, calc(100dvh - 18rem))' }}>
      <div>
        <div className="label">Live streams</div>
        <h1 id="tw-h" className="text-xl">Watch</h1>
      </div>

      <div role="group" aria-label="Channels" className="flex flex-wrap items-center gap-2">
        {all.map((x) => (
          <span key={x.c} className="inline-flex items-center gap-1">
            <button type="button" aria-pressed={x.c === ch.c} onClick={() => setCurrent(x.c)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border-control px-3 py-1 text-sm font-semibold ${x.c === ch.c ? 'border-accent bg-accent text-on-accent' : 'border-text bg-bg text-text hover:bg-surface'}`}>
              <Avatar name={x.n} size={24} />{x.n}
            </button>
            {x.mine && <button type="button" onClick={() => remove(x.c)} aria-label={`Remove ${x.n}`} className="min-h-[40px] px-1.5 text-muted hover:text-danger">✕</button>}
          </span>
        ))}
        <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className="min-h-[40px] rounded-full border-control border-dashed border-border-input px-3 py-1 text-sm font-semibold text-muted hover:text-text">+ Add</button>
      </div>
      {adding && (
        <form onSubmit={add} className="flex max-w-md gap-2">
          <input autoFocus className={`${inputClass} grow`} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Twitch username or link, like faze" aria-label="Twitch username" />
          <Button variant="primary" type="submit">Watch</Button>
        </form>
      )}

      {/* On large screens the player and chat share one height taken from the window (--watch-h: the screen minus the header,
          title and channel row), so the card fills the screen without running past its bottom edge. Below that it stacks. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="grid min-w-0 content-start gap-3">
          <div className="relative">
            <Player key={`${ch.c}:${replay?.id ?? ''}`} channel={ch.c} video={replay?.id} onStatus={setStatus} onPlaying={(p) => { playing.current = p; }} />
            <div ref={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <b className="truncate">{ch.n}</b>
                {status && <span role="status" className={`rounded-sm px-1.5 py-0.5 text-xs font-bold ${status === 'live' ? 'bg-accent text-on-accent' : 'bg-surface text-muted'}`}>{STATUS[status]}</span>}
              </div>
              <span className="text-body-sm text-muted">{ch.d}</span>
              {replay && <p className="m-0 mt-1 text-body-sm">{ch.n} is offline. Replaying their latest broadcast: <b>{replay.title}</b> ({new Date(replay.created_at).toLocaleDateString()}).</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={share}>Share</Button>
              <a className="inline-flex min-h-[40px] items-center rounded-sm border-2 border-accent bg-accent px-3.5 py-2 text-sm font-bold text-on-accent hover:brightness-90" href={`https://www.twitch.tv/${encodeURIComponent(ch.c)}`} target="_blank" rel="noopener noreferrer">Follow on Twitch ↗</a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Reactions">
            {REACTIONS.map((r) => <button key={r} type="button" onClick={() => react(r)} aria-label={`React ${r}`} className="min-h-[40px] rounded-full border-control border-text bg-bg px-3 text-lg hover:bg-surface">{r}</button>)}
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-3">
          <div role="group" aria-label="Chat" className="flex gap-2">
            <button type="button" aria-pressed={pane === 'chat'} onClick={() => setPane('chat')} className={`min-h-[40px] flex-1 rounded-sm border-2 px-3 text-sm font-bold ${pane === 'chat' ? 'border-accent bg-accent text-on-accent' : 'border-text bg-bg'}`}>Twitch chat</button>
            <button type="button" aria-pressed={pane === 'vault'} onClick={() => setPane('vault')} className={`min-h-[40px] flex-1 rounded-sm border-2 px-3 text-sm font-bold ${pane === 'vault' ? 'border-accent bg-accent text-on-accent' : 'border-text bg-bg'}`}>Vault comments</button>
          </div>
          {pane === 'chat'
            ? <iframe key={ch.c} title={`${ch.n} Twitch chat`} className="h-[min(420px,60dvh)] w-full rounded-md border-0 bg-surface lg:h-[calc(var(--watch-h)-3.25rem)]"
                src={`https://www.twitch.tv/embed/${encodeURIComponent(ch.c)}/chat?parent=${encodeURIComponent(location.hostname)}${darkMode() ? '&darkpopout' : ''}`} />
            : <Comments channel={ch.c} />}
        </div>
      </div>
      <p className="m-0 text-body-sm text-muted" aria-live="polite">
        {!api.twitchBeat ? null : user
          ? <>Earn <b>10 points</b> for every 30 seconds you watch{points ? <> · {points.today} of {points.cap} points earned today</> : null}.</>
          : 'Sign in to earn points while you watch.'}
      </p>
      <p className="m-0 text-[13px] text-muted">LIVE or OFFLINE comes from the player itself. Channels you add are kept on this device.</p>
    </section>
  );
}
