// Demo-mode copy of the profile-logo pool (the API owns the real one in src/services/logos.js).
// Images are the mark-only PNGs from the brand logo folder, served from /public/logos.
export const LOGO_COST = 2000;
const LOGOS = [['white', '#ffffff'], ['black', '#000000'], ['red-outline', '#e4002b'], ['white-outline', '#ffffff']];
const BACKDROPS = ['#0b0b0b', '#18181b', '#1f2937', '#2563eb', '#7c3aed', '#0f766e', '#be185d', '#b45309', '#e4002b', '#0ea5e9', '#22c55e', '#fbbf24', '#e5e5e5', '#f5f5f5', '#ffffff'];

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

export const PAIRINGS = LOGOS.flatMap(([logo_id, ink]) => BACKDROPS.filter((bg) => contrast(ink, bg) >= 3).map((backdrop) => ({ logo_id, backdrop, image: `/logos/${logo_id}.png` })));
