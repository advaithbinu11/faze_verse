import { config } from '../config.js';
import { col } from '../db.js';
import { announceMatchStart, announceReminder, discordEnabled } from '../services/discord.js';
import { processNextPayout } from '../services/payout.js';

// Atomically claims a notification slot (so multiple instances never double-send) and
// releases it if the Discord call fails so the next tick retries.
async function notifyOnce(filter, flag, send) {
  for (;;) {
    const event = await col('events').findOneAndUpdate(
      { ...filter, [flag]: { $exists: false } },
      { $set: { [flag]: new Date() } },
      { returnDocument: 'after' },
    );
    if (!event) return;
    try {
      await send(event);
    } catch (err) {
      await col('events').updateOne({ _id: event._id }, { $unset: { [flag]: '' } });
      throw err;
    }
  }
}

async function discordTick() {
  if (!discordEnabled() || !config.discord.announceChannelId) return;
  const soon = new Date(Date.now() + config.discord.reminderMinutes * 60_000);
  await notifyOnce({ status: 'upcoming', start_time: { $gt: new Date(), $lte: soon } }, 'reminder_sent_at', announceReminder);
  await notifyOnce({ status: 'live' }, 'start_alert_sent_at', announceMatchStart);
}

async function payoutTick() {
  while (await processNextPayout());
}

function loop(name, intervalMs, fn) {
  let stopped = false;
  let timer;
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[worker:${name}]`, err.message);
    }
    if (!stopped) {
      timer = setTimeout(run, intervalMs);
      timer.unref();
    }
  };
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export function startWorkers() {
  const stops = [loop('payout', 10_000, payoutTick), loop('discord', 60_000, discordTick)];
  console.log(`[workers] started (discord ${discordEnabled() ? 'on' : 'off'})`);
  return () => stops.forEach((stop) => stop());
}
