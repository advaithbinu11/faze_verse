import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar, Button, EmptyState, ErrorState, Skeleton, errorMessage, inputClass } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const MAX = 240;
const MAX_COMMENT = 200;
const COMMENTS_SHOWN = 2;

// A player's name and avatar link to their page. Your own name goes to your Welcome page.
function Author({ author, me, large }) {
  const to = author.id && author.id !== me ? `/u/${author.id}` : '/welcome';
  return (
    <Link to={to} className="inline-flex min-w-0 items-center gap-2 font-bold no-underline hover:underline">
      <Avatar name={author.name} size={large ? 40 : 28} color={author.profile_color ?? undefined} />
      <span className="truncate">{author.name}</span>
    </Link>
  );
}

function CommentForm({ postId, onDone }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api.addComment(postId, text.trim()); setText(''); await onDone(); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <label htmlFor={`c-${postId}`} className="sr-only">Write a comment</label>
      <input id={`c-${postId}`} value={text} maxLength={MAX_COMMENT} onChange={(e) => setText(e.target.value)} className={`${inputClass} min-w-0 grow`} placeholder="Add a comment" />
      <Button variant="primary" type="submit" loading={busy} disabled={!text.trim()}>Reply</Button>
    </form>
  );
}

function Post({ post: p, me, onLike, onChanged }) {
  const [all, setAll] = useState(false);
  const [replying, setReplying] = useState(false);
  const hidden = p.comments.length - COMMENTS_SHOWN;
  const comments = all ? p.comments : p.comments.slice(0, COMMENTS_SHOWN);
  return (
    <article className="border-t border-border py-4">
      <div className="flex items-baseline gap-2">
        <Author author={p.author} me={me} large />
        <time className="flex-none text-sm text-muted" dateTime={p.at}>{new Date(p.at).toLocaleString()}</time>
      </div>
      <p className="my-2 ml-[52px] break-words text-body-sm">{p.text}</p>
      <div className="ml-[52px] flex flex-wrap items-center gap-x-4">
        <button type="button" aria-pressed={p.liked} onClick={() => onLike(p.id)} className={`min-h-[44px] text-sm font-semibold ${p.liked ? 'text-accent-text' : 'text-muted'}`}>
          {p.liked ? 'Liked' : 'Like'} · {p.likes}<span className="sr-only"> likes</span>
        </button>
        <button type="button" aria-expanded={replying} onClick={() => setReplying(!replying)} className="min-h-[44px] text-sm font-semibold text-muted">
          Comment · {p.comments.length}<span className="sr-only"> comments</span>
        </button>
      </div>
      {(comments.length > 0 || replying) && (
        <div className="ml-[52px]">
          {comments.length > 0 && (
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <Author author={c.author} me={me} />
                  <time className="ml-2 text-xs text-muted" dateTime={c.at}>{new Date(c.at).toLocaleString()}</time>
                  <p className="m-0 mt-0.5 break-words">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
          {!all && hidden > 0 && <button type="button" onClick={() => setAll(true)} className="mt-1 min-h-[44px] text-sm font-semibold underline">Show {hidden} more comment{hidden === 1 ? '' : 's'}</button>}
          {replying && <CommentForm postId={p.id} onDone={async () => { await onChanged(); setAll(true); }} />}
        </div>
      )}
    </article>
  );
}

export default function Feed() {
  const { user, status, login, refresh } = useAuth();
  const toast = useToast();
  const posts = useAsync(() => (user ? api.listPosts() : []), [user?._id]);
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

  if (status === 'loading') return <Skeleton className="h-64" />;
  if (!user) {
    return <div className="max-w-feed"><h1 className="text-xl">Fan feed</h1><EmptyState title="Sign in to join the feed" body="Posts and comments come from FaZe Vault players, so you need an account to read and write them." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} /></div>;
  }

  return (
    <div className="max-w-feed">
      <h1 className="text-xl">Fan feed</h1>
      <p className="mb-3 text-body-sm text-muted">Say something about the match. Your first 3 posts earn 3 points each. Tap a name to see that player.</p>
      <form onSubmit={submit} className="mb-6 grid gap-2">
        <label htmlFor="post" className="sr-only">Write a post</label>
        <textarea id="post" rows={3} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} placeholder="What was your read on that last round?" />
        <div className="flex items-center gap-3">
          <Button variant="primary" type="submit" loading={busy} disabled={!text.trim()}>Post</Button>
          <span className="text-sm text-muted" aria-live="polite">{MAX - text.length} left</span>
        </div>
      </form>

      {posts.loading ? <div className="grid gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        : posts.error ? <ErrorState error={posts.error} onRetry={posts.reload} />
        : !posts.data.length ? <EmptyState title="Quiet in here" body="Be the first to post about the match." />
        : posts.data.map((p) => <Post key={p.id} post={p} me={user._id} onLike={like} onChanged={posts.reload} />)}
    </div>
  );
}
