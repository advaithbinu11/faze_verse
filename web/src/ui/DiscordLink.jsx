import { useState } from 'react';
import { Button, errorMessage } from './primitives.jsx';
import { api } from '../data/index.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

// Starts the Discord OAuth flow; the API reads the Discord user id from Discord itself, so nobody types it in.
export function useDiscordLink() {
  const toast = useToast();
  const [linking, setLinking] = useState(false);
  const link = async () => {
    setLinking(true);
    try { window.location.href = (await api.startDiscordLink()).url; } catch (err) { toast(errorMessage(err), 'error'); setLinking(false); }
  };
  return { link, linking };
}

// Prompt shown to signed-in players who have not linked Discord yet. Renders nothing otherwise (or in demo mode).
export function DiscordLinkBanner() {
  const { user } = useAuth();
  const { link, linking } = useDiscordLink();
  if (!user || user.discord_id || !api.startDiscordLink) return null;
  return (
    <div className="frame flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="m-0 min-w-0 text-body-sm">Link Discord to get your party voice channels and match reminders. It takes one click.</p>
      <Button type="button" variant="primary" onClick={link} loading={linking}>Link Discord</Button>
    </div>
  );
}
