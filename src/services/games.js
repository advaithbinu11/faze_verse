// Games sold through the Epic Games Store have no Steam library entry to check, so the Steam ownership
// rule for parties does not apply to them. Names are compared case-insensitively.
const EPIC_GAMES = new Set(['fortnite', 'rocket league']);

export const isEpicGame = (name) => EPIC_GAMES.has(String(name ?? '').trim().toLowerCase());
