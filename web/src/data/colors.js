// Mirrors src/services/colors.js on the API. Stored as lowercase #rrggbb.
export const PALETTE = [
  ['Red', '#e4002b'], ['Orange', '#f97316'], ['Amber', '#f59e0b'], ['Lime', '#84cc16'], ['Green', '#16a34a'],
  ['Teal', '#0d9488'], ['Cyan', '#06b6d4'], ['Blue', '#2563eb'], ['Indigo', '#4f46e5'], ['Purple', '#9333ea'],
  ['Pink', '#ec4899'], ['Slate', '#64748b'], ['White', '#f5f5f5'], ['Black', '#111111'],
];
export const HEX_COLOR = /^#[0-9a-f]{6}$/;
export const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)][1];

// WCAG relative luminance -> pick whichever of black/white text has the higher contrast on this color.
export function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // contrast vs white = 1.05 / (L + .05); vs #111 (luminance .0056) = (L + .05) / .0556
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0556 ? '#ffffff' : '#111111';
}
