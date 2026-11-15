// Games sold through the Epic Games Store have no Steam library entry to check, so the Steam ownership
// rule for parties does not apply to them. Names are compared case-insensitively.
const EPIC_GAMES = new Set(['fortnite', 'rocket league']);

export const isEpicGame = (name) => EPIC_GAMES.has(String(name ?? '').trim().toLowerCase());

// Games shown in the web app's side list, in display order. Library names (Steam, Epic) are matched loosely.
export const GAME_CATALOG = [
  ['Counter-Strike 2', /counter-?strike|\bcs\s?2?\b|\bcsgo\b/i],
  ['Valorant', /valorant/i],
  ['Fortnite', /fortnite/i],
  ['Apex Legends', /apex/i],
  ['Rocket League', /rocket\s?league/i],
  ['Call of Duty', /call of duty|warzone|\bcod\b/i],
];
export const canonicalGame = (name) => GAME_CATALOG.find(([, re]) => re.test(name ?? ''))?.[0] ?? null;
