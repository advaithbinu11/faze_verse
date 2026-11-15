// Client for the Express API in ../../src. Only covers endpoints the backend has today;
// index.js falls back to the fake layer for the rest (feed, perks, party match history).
const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const TOKEN_KEY = 'fv_token';
// Optional: the standalone similar-users service (find_similiar_users). When unset, suggestions come from the main API.
// Optional: the Twitch service (npm run twitch in the API). When unset, Twitch calls go to the main API.
const TWITCH_BASE = import.meta.env.VITE_TWITCH_URL?.replace(/\/$/, '') || BASE;
const SIMILAR_BASE = import.meta.env.VITE_SIMILAR_URL?.replace(/\/$/, '');

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage blocked */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } },
};

async function request(path, { method = 'GET', body, base = BASE } = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) tokenStore.clear();
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status, details: data.details });
  return data;
}

// The standalone service is unauthenticated and keyed by user id, so no bearer token is sent to it.
// It also returns discord_channel, which is dropped here: contact info other users did not agree to publish.
async function similarFromService(userId, limit) {
  if (userId === 'me') throw new Error('The similar-users service needs a user id.');
  const res = await fetch(`${SIMILAR_BASE}/users/${encodeURIComponent(userId)}/similar?limit=${limit}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status });
  return { ...data, matches: data.matches.map(({ discord_channel, ...m }) => m) }; // eslint-disable-line no-unused-vars
}

export const loginUrl = () => `${BASE}/auth/steam`;

export const real = {
  mode: 'live',
  signup: (body) => request('/auth/signup', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  getMe: () => request('/users/me'),
  startDiscordLink: () => request('/users/me/discord/link', { method: 'POST' }),
  updateProfile: (patch) => request('/users/me', { method: 'PATCH', body: patch }),
  listTransactions: () => request('/users/me/transactions'),
  getSimilar: (userId = 'me', limit = 5) => (SIMILAR_BASE ? similarFromService(userId, limit) : request(`/users/${userId}/similar?limit=${limit}`)),
  getFriends: (userId = 'me') => request(`/users/${userId}/friends`),
  getProfile: (userId) => request(`/users/${userId}/profile`),
  placeMerchOrder: (body) => request('/merch/orders', { method: 'POST', body }),
  listPerks: () => request('/perks'),
  listMyPerks: () => request('/perks/mine'),
  redeemPerk: (id) => request(`/perks/${id}/redeem`, { method: 'POST' }),
  getCoupon: (code) => request(`/perks/coupons/${encodeURIComponent(code.trim())}`),
  useCoupon: (code) => request(`/perks/coupons/${encodeURIComponent(code.trim())}/use`, { method: 'POST' }),
  addFriend: (userId) => request('/users/me/friends', { method: 'POST', body: { user_id: userId } }),
  listEvents: ({ status } = {}) => request(`/events${status ? `?status=${status}` : ''}`),
  getMyPrediction: (id) => request(`/events/${id}/predictions/me`).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
  placePrediction: (id, body) => request(`/events/${id}/predictions`, { method: 'POST', body }),
  startWatch: (videoId) => request('/youtube/sessions', { method: 'POST', body: { videoId } }),
  twitchBeat: (body) => request('/twitch/watch/beat', { method: 'POST', body, base: TWITCH_BASE }),
  getTwitchLatestVideo: (channel) => request(`/twitch/channels/${encodeURIComponent(channel)}/latest-video`, { base: TWITCH_BASE }),
  watchEvent: (sessionId, body) => request(`/youtube/sessions/${sessionId}/events`, { method: 'POST', body }),
  listClusters: () => request('/parties/clusters'),
  listParties: () => request('/parties'),
  matchParty: (body) => request('/parties/match', { method: 'POST', body }),
  joinParty: (id) => request(`/parties/${id}/join`, { method: 'POST' }),
  leaveParty: (id) => request(`/parties/${id}/leave`, { method: 'POST' }),
};
