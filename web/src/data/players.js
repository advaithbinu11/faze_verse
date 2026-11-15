// Roster for the "favourite players" picker, drawn from Fazeclanhistory.pdf ("FaZe Clan: A Timeline, 2010-2026").
// Only people the document describes as FaZe members or alumni. Grouping is by role, not by year.
export const PLAYER_GROUPS = [
  { label: 'Founders and early members', players: ['ClipZ', 'Temperrr', 'Fakie', 'Apex', 'Spratt', 'Heist', 'Pamaj', 'Rain', 'WaRTeK'] },
  { label: 'Creators and Call of Duty', players: ['Rug', 'Banks', 'Adapt', 'Jev', 'Teeqo', 'Censor', 'ZooMaa', 'Clayster'] },
  { label: 'Esports and streamers', players: ['karrigan', 'Twistzz', 's1mple', 'Tfue', 'Nickmercs', 'Mongraal', 'Sway', 'Swagg', 'Cented', 'Ewok', 'Deestroying'] },
];
export const MAX_FAVORITES = 10;
export const PLAYER_PATTERN = /^[\w .-]{1,30}$/; // mirrors the API's validation
