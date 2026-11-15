import { DISCOUNT_KINDS } from './perks.js';

// ---- Rules -------------------------------------------------------------------------------------------------------------
export const POINTS_PER_BLOCK = 1000; // points earned for every full $10 actually paid (after any discount code)
export const BLOCK_CENTS = 1000;
export const SIGNATURE_POINTS = 15000; // points per piece to have it signed, paid from the balance you already have
export const MAX_QTY = 10;
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SIZED = new Set(['Jerseys', 'Tees', 'Hoodies', 'Outerwear']);
export const isSized = (category) => SIZED.has(category);

// Whole $10 blocks only: $39.99 earns 3,000 points, $40.00 earns 4,000.
export const pointsEarned = (totalCents) => Math.floor(totalCents / BLOCK_CENTS) * POINTS_PER_BLOCK;

// A reward code takes a percentage off the subtotal, or a fixed amount that never exceeds it. Whole cents throughout.
export function discountCents(coupon, subtotalCents) {
  if (!coupon || !DISCOUNT_KINDS.includes(coupon.kind) || subtotalCents < (coupon.min_spend_cents ?? 0)) return 0;
  return coupon.kind === 'merch_percent' ? Math.round((subtotalCents * coupon.percent) / 100) : Math.min(coupon.amount_cents, subtotalCents);
}

export function priceOrder({ unit_cents, qty, coupon }) {
  const subtotal_cents = unit_cents * qty;
  const discount_cents = discountCents(coupon, subtotal_cents);
  const total_cents = subtotal_cents - discount_cents;
  return { subtotal_cents, discount_cents, total_cents, points_earned: pointsEarned(total_cents) };
}

// ---- Catalogue (prices are authoritative here; the web app only displays them) ------------------------------------------
export const MERCH_ITEMS = [
  { id: 'redline-track-suit', name: "Redline Track Suit", category: 'Outerwear', price_cents: 15000, sold_out: false },
  { id: '2027-esports-team-jersey', name: "2027 Esports Team Jersey", category: 'Jerseys', price_cents: 9000, sold_out: false },
  { id: '2027-counter-strike-jersey', name: "2027 Counter Strike Jersey", category: 'Jerseys', price_cents: 9000, sold_out: false },
  { id: 'varsity-tee-black', name: "Varsity Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'varsity-tee-slate-blue', name: "Varsity Tee (Slate Blue)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'nvg-tee-forest-green', name: "NVG Tee (Forest Green)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'radio-hoodie-black', name: "Radio Hoodie (Black)", category: 'Hoodies', price_cents: 9000, sold_out: false },
  { id: 'cybear-xl-mouse-pad', name: "Cybear XL Mouse Pad", category: 'Gear', price_cents: 3000, sold_out: false },
  { id: 'cybear-tee-black', name: "Cybear Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'cybear-hoodie-vintage-black', name: "Cybear Hoodie (Vintage Black)", category: 'Hoodies', price_cents: 9000, sold_out: false },
  { id: 'world-tour-tee-black', name: "World Tour Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'world-tour-tee-white', name: "World Tour Tee (White)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'cafe-flanque-tee', name: "Café Flanqué Tee", category: 'Tees', price_cents: 4200, sold_out: true },
  { id: 'tri-color-track-suit', name: "Tri Color Track Suit", category: 'Outerwear', price_cents: 12000, sold_out: false },
  { id: 'tri-color-jersey', name: "Tri Color Jersey", category: 'Jerseys', price_cents: 6800, sold_out: false },
  { id: 'night-mode-3m-track-suit', name: "Night Mode 3M Track Suit", category: 'Outerwear', price_cents: 15000, sold_out: false },
  { id: '2026-stallions-jersey', name: "2026 Stallions Jersey", category: 'Jerseys', price_cents: 8000, sold_out: false },
  { id: 'flank-tee-vintage-black', name: "Flank Tee (Vintage Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'stallions-crest-tee-grey', name: "Stallions Crest Tee (Grey)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'stallions-college-tee', name: "Stallions College Tee", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'stallions-hoodie-black', name: "Stallions Hoodie (Black)", category: 'Hoodies', price_cents: 9000, sold_out: false },
  { id: 'stallions-hoodie-mahogany', name: "Stallions Hoodie (Mahogany)", category: 'Hoodies', price_cents: 9000, sold_out: false },
  { id: 'flank-hoodie-black', name: "Flank Hoodie (Black)", category: 'Hoodies', price_cents: 9000, sold_out: false },
  { id: 'victory-flag-tee-black', name: "Victory Flag Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'victory-flag-tee-camo', name: "Victory Flag Tee (Camo)", category: 'Tees', price_cents: 4400, sold_out: false },
  { id: 'victory-flag-tee-wheat', name: "Victory Flag Tee (Wheat)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'battle-damage-tee-black', name: "Battle Damage Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'battle-damage-tee-grey', name: "Battle Damage Tee (Grey)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: '2026-esports-jersey', name: "2026 Esports Jersey", category: 'Jerseys', price_cents: 8000, sold_out: false },
  { id: '2026-counter-strike-jersey', name: "2026 Counter Strike Jersey", category: 'Jerseys', price_cents: 8000, sold_out: false },
  { id: 'distressed-jersey-hoodie', name: "Distressed Jersey Hoodie", category: 'Hoodies', price_cents: 12000, sold_out: false },
  { id: 'jersey-tee-mineral-wash', name: "Jersey Tee (Mineral Wash)", category: 'Tees', price_cents: 4600, sold_out: false },
  { id: 'digi-camo-five-star-tee-black', name: "Digi Camo Five Star Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'digi-camo-five-star-tee-white', name: "Digi Camo Five Star Tee (White)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'retro-neon-five-star-tee-black', name: "Retro Neon Five Star Tee (Black)", category: 'Tees', price_cents: 4000, sold_out: false },
  { id: 'retro-neon-five-star-tee-mahogany', name: "Retro Neon Five Star Tee (Mahogany)", category: 'Tees', price_cents: 4000, sold_out: true },
  { id: 'team-travel-duffel-bag', name: "Team Travel Duffel Bag", category: 'Gear', price_cents: 7500, sold_out: false },
  { id: 'back-2-back-champions-tee', name: "Back 2 Back Champions Tee", category: 'Tees', price_cents: 4000, sold_out: true },
  { id: 'f-foam-finger', name: "F Foam Finger", category: 'Gear', price_cents: 2000, sold_out: false },
  { id: 'foam-finger-keychain', name: "Foam Finger Keychain", category: 'Gear', price_cents: 700, sold_out: false },
  { id: 'four-star-ceramic-mug', name: "Four Star Ceramic Mug", category: 'Gear', price_cents: 1200, sold_out: false },
  { id: 'four-star-trucker-hat-black', name: "Four Star Trucker Hat (Black)", category: 'Hats', price_cents: 2800, sold_out: false },
  { id: 'four-star-6-panel-hat-camo', name: "Four Star 6 Panel Hat (Camo)", category: 'Hats', price_cents: 2800, sold_out: false },
  { id: 'four-star-3d-snapback-black', name: "Four Star 3D Snapback (Black)", category: 'Hats', price_cents: 2500, sold_out: false },
  { id: 'four-star-3d-snapback-red', name: "Four Star 3D Snapback (Red)", category: 'Hats', price_cents: 2500, sold_out: false },
  { id: 'four-star-hoodie-black', name: "Four Star Hoodie (Black)", category: 'Hoodies', price_cents: 8800, sold_out: false },
  { id: 'four-star-hoodie-grey', name: "Four Star Hoodie (Grey)", category: 'Hoodies', price_cents: 8800, sold_out: false },
  { id: 'four-star-zip-hoodie', name: "Four Star Zip Hoodie", category: 'Hoodies', price_cents: 7500, sold_out: false },
  { id: 'four-star-crewneck-camo', name: "Four Star Crewneck (Camo)", category: 'Hoodies', price_cents: 7500, sold_out: false },
  { id: 'four-star-left-chest-tee-black', name: "Four Star Left Chest Tee (Black)", category: 'Tees', price_cents: 3200, sold_out: true },
  { id: 'four-star-left-chest-tee-white', name: "Four Star Left Chest Tee (White)", category: 'Tees', price_cents: 3200, sold_out: false },
  { id: 'four-star-left-chest-tee-camo', name: "Four Star Left Chest Tee (Camo)", category: 'Tees', price_cents: 3600, sold_out: false },
  { id: 'four-star-tee-black', name: "Four Star Tee (Black)", category: 'Tees', price_cents: 3200, sold_out: false },
  { id: 'four-star-tee-white', name: "Four Star Tee (White)", category: 'Tees', price_cents: 3200, sold_out: false },
  { id: 'four-star-tee-grey', name: "Four Star Tee (Grey)", category: 'Tees', price_cents: 3200, sold_out: false },
  { id: '2025-esports-jersey', name: "2025 Esports Jersey", category: 'Jerseys', price_cents: 8000, sold_out: false },
];
export const findItem = (id) => MERCH_ITEMS.find((m) => m.id === id);
