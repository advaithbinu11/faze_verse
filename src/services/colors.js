// Profile colours are stored as lowercase #rrggbb strings in users.profile_color.
export const PALETTE = [
  '#e4002b', '#f97316', '#f59e0b', '#84cc16', '#16a34a', '#0d9488', '#06b6d4',
  '#2563eb', '#4f46e5', '#9333ea', '#ec4899', '#64748b', '#f5f5f5', '#111111',
];
export const HEX_COLOR = /^#[0-9a-f]{6}$/;
export const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
