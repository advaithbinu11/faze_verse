import { config } from '../config.js';
import { HttpError } from '../errors.js';

const OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const OPENID_NS = 'http://specs.openid.net/auth/2.0';

export const callbackUrl = () => `${config.apiBaseUrl}/auth/steam/callback`;

export function buildLoginUrl() {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': callbackUrl(),
    'openid.realm': config.apiBaseUrl,
    'openid.identity': `${OPENID_NS}/identifier_select`,
    'openid.claimed_id': `${OPENID_NS}/identifier_select`,
  });
  return `${OPENID_ENDPOINT}?${params}`;
}

// Verifies the OpenID assertion directly with Steam and returns the SteamID64.
export async function verifyAssertion(query) {
  if (query['openid.mode'] !== 'id_res') throw new HttpError(400, 'Steam login was cancelled');
  if (query['openid.op_endpoint'] !== OPENID_ENDPOINT) throw new HttpError(400, 'Unexpected OpenID provider');
  if (query['openid.return_to'] !== callbackUrl()) throw new HttpError(400, 'return_to mismatch');

  const match = CLAIMED_ID.exec(String(query['openid.claimed_id'] ?? ''));
  if (!match) throw new HttpError(400, 'Invalid claimed_id');

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('openid.') && typeof value === 'string') body.set(key, value);
  }
  body.set('openid.mode', 'check_authentication');

  const res = await fetch(OPENID_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok || !/^is_valid\s*:\s*true$/m.test(text)) throw new HttpError(401, 'Steam assertion could not be verified');
  return match[1];
}

async function steamApi(path, params) {
  if (!config.steamApiKey) throw new HttpError(503, 'Steam API key is not configured');
  const url = `https://api.steampowered.com/${path}?${new URLSearchParams({ key: config.steamApiKey, format: 'json', ...params })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new HttpError(502, `Steam API ${path} failed (${res.status})`);
  return res.json();
}

export async function getProfile(steamId) {
  const data = await steamApi('ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId });
  const p = data.response?.players?.[0];
  if (!p) throw new HttpError(502, 'Steam profile not found');
  return {
    name: p.personaname || `steam_${steamId}`,
    avatar: p.avatarfull,
    profile_url: p.profileurl,
    visibility: p.communityvisibilitystate, // 3 = public
  };
}

// Returns [] for private libraries (Steam responds with an empty object).
export async function getOwnedGames(steamId) {
  const data = await steamApi('IPlayerService/GetOwnedGames/v1/', {
    steamid: steamId,
    include_appinfo: '1',
    include_played_free_games: '1',
  });
  return (data.response?.games ?? []).map((g) => ({
    appid: g.appid,
    name: g.name ?? `app_${g.appid}`,
    playtime_forever: g.playtime_forever ?? 0,
  }));
}

// Public community inventory (default: CS2). Returns null when the inventory is private.
export async function getInventory(steamId, appId = 730, contextId = 2) {
  const res = await fetch(
    `https://steamcommunity.com/inventory/${steamId}/${appId}/${contextId}?l=english&count=500`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (res.status === 403 || res.status === 401) return null;
  if (!res.ok) throw new HttpError(502, `Steam inventory failed (${res.status})`);
  const data = await res.json();
  if (!data?.assets) return { total: 0, items: [] };
  const descriptions = new Map(data.descriptions?.map((d) => [`${d.classid}_${d.instanceid}`, d]));
  const items = data.assets.map((a) => {
    const d = descriptions.get(`${a.classid}_${a.instanceid}`);
    return { assetid: a.assetid, name: d?.market_hash_name ?? d?.name, tradable: d?.tradable === 1, marketable: d?.marketable === 1 };
  });
  return { total: data.total_inventory_count ?? items.length, items };
}
