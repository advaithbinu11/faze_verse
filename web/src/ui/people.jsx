import { Link } from 'react-router';
import { Avatar } from './primitives.jsx';

// Text + dot: online state never relies on color alone.
export function OnlineStatus({ online }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${online ? 'text-success' : 'text-muted'}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-success' : 'border-2 border-border-input'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

// A whole row is one link to that player's page, so the target is large and the name is the accessible label.
export const personRow = 'flex items-center gap-3 border-t border-border py-3 no-underline hover:bg-surface';

export function FriendRow({ friend, to = `/u/${friend.id}` }) {
  return (
    <li>
      <Link to={to} className={personRow}>
        <Avatar name={friend.name} size={44} color={friend.profile_color ?? undefined} />
        <span className="min-w-0 grow truncate font-bold">{friend.name}</span>
        <OnlineStatus online={friend.online} />
      </Link>
    </li>
  );
}
