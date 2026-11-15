import { useEffect, useRef, useState } from 'react';
import { api } from '../data/index.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import { EmptyState } from '../ui/primitives.jsx';

const VIDEO_ID = import.meta.env.VITE_WATCH_VIDEO_ID;
const STATES = { 0: 'ENDED', 1: 'PLAYING', 2: 'PAUSED', 3: 'BUFFERING' };
const HEARTBEAT_MS = 15_000;

let apiPromise;
const loadYouTube = () => (apiPromise ??= new Promise((resolve, reject) => {
  if (window.YT?.Player) return resolve(window.YT);
  window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = () => { apiPromise = undefined; reject(new Error('Could not load the video player.')); };
  document.head.appendChild(s);
}));

// Forwards player state to the server, which measures watch time itself. The client never reports "seconds watched".
export function WatchCard() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const host = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!VIDEO_ID || !user) return;
    let player, session, beat, dead = false;

    const send = async (state) => {
      try {
        if (!session) {
          if (state !== 'PLAYING') return;
          session = await api.startWatch(VIDEO_ID);
        }
        const r = await api.watchEvent(session.session_id, { state, position: player.getCurrentTime() });
        if (r.awarded) { toast(`+${r.awarded} points for finishing the video.`); refresh(); }
      } catch (e) {
        if (e.status !== 409) setError(e.message);
      }
    };

    loadYouTube().then((YT) => {
      if (dead) return;
      player = new YT.Player(host.current, {
        videoId: VIDEO_ID,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            const state = STATES[e.data];
            clearInterval(beat);
            if (!state) return;
            send(state);
            if (state === 'PLAYING') beat = setInterval(() => send('PLAYING'), HEARTBEAT_MS);
          },
        },
      });
    }).catch((e) => setError(e.message));

    return () => { dead = true; clearInterval(beat); player?.destroy?.(); };
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="watch-h">
      <h2 id="watch-h" className="text-lg">Watch to earn</h2>
      <p className="mb-3 text-body-sm text-muted">Play the featured video to the end for bonus points, once per video.</p>
      {!VIDEO_ID ? (
        <EmptyState title="No video scheduled" body="A featured video appears here once one is registered for points." />
      ) : !user ? (
        <EmptyState title="Sign in to earn" body="Watch time only counts for signed-in accounts." />
      ) : (
        <>
          <div className="aspect-video overflow-hidden rounded-md bg-black sm:max-w-[71.43%]"><div ref={host} className="h-full w-full" /></div>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </>
      )}
    </section>
  );
}
