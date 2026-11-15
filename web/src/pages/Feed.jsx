import { useState } from 'react';
import { Avatar, Button, EmptyState, ErrorState, Skeleton, errorMessage, inputClass } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const MAX = 240;

export default function Feed() {
  const { user, login, refresh } = useAuth();
  const toast = useToast();
  const posts = useAsync(() => api.listPosts(), []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { bonus } = await api.createPost(text.trim());
      setText('');
      toast(bonus ? `Posted. +${bonus} points.` : 'Posted.');
      await Promise.all([posts.reload(), refresh()]);
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const like = async (id) => { try { await api.toggleLike(id); posts.reload(); } catch (err) { toast(errorMessage(err), 'error'); } };

  return (
    <div className="max-w-feed">
      <h1 className="text-xl">Fan feed</h1>
      <p className="mb-3 text-body-sm text-muted">Say something about the match. Your first 3 posts earn 3 points each.</p>
      {user ? (
        <form onSubmit={submit} className="mb-6 grid gap-2">
          <label htmlFor="post" className="sr-only">Write a post</label>
          <textarea id="post" rows={3} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} placeholder="What was your read on that last round?" />
          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" loading={busy} disabled={!text.trim()}>Post</Button>
            <span className="text-sm text-muted" aria-live="polite">{MAX - text.length} left</span>
          </div>
        </form>
      ) : <div className="mb-6"><EmptyState title="Sign in to post" body="Reading is open to everyone. Posting needs a linked account." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} /></div>}

      {posts.loading ? <div className="grid gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        : posts.error ? <ErrorState error={posts.error} onRetry={posts.reload} />
        : !posts.data.length ? <EmptyState title="Quiet in here" body="Be the first to post about the match." />
        : posts.data.map((p) => (
          <article key={p.id} className="flex gap-3 border-t border-border py-3.5">
            <Avatar name={p.author} />
            <div className="min-w-0 grow">
              <div className="font-bold">{p.author} <time className="ml-1 text-sm font-normal text-muted" dateTime={p.at}>{new Date(p.at).toLocaleString()}</time></div>
              <p className="my-1 break-words text-body-sm">{p.text}</p>
              <button type="button" aria-pressed={p.liked} onClick={() => like(p.id)}
                className={`min-h-[40px] text-sm font-semibold ${p.liked ? 'text-accent-text' : 'text-muted'}`}>
                {p.liked ? 'Liked' : 'Like'} · {p.likes}<span className="sr-only"> likes</span>
              </button>
            </div>
          </article>
        ))}
    </div>
  );
}
