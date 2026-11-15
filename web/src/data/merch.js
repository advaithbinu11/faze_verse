// Catalogue ported from the FaZe Lobby prototype. Photos live in public/merch/.
// `was` is the pre-sale price (null when the item is not on sale).
export const MERCH = [
  {id: "redline-track-suit", name: "Redline Track Suit", price: 150, was: null, category: "Outerwear", soldOut: false, image: "/merch/redline-track-suit.jpg"},
  {id: "2027-esports-team-jersey", name: "2027 Esports Team Jersey", price: 90, was: null, category: "Jerseys", soldOut: false, image: "/merch/2027-esports-team-jersey.jpg"},
  {id: "2027-counter-strike-jersey", name: "2027 Counter Strike Jersey", price: 90, was: null, category: "Jerseys", soldOut: false, image: "/merch/2027-counter-strike-jersey.jpg"},
  {id: "varsity-tee-black", name: "Varsity Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/varsity-tee-black.jpg"},
  {id: "varsity-tee-slate-blue", name: "Varsity Tee (Slate Blue)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/varsity-tee-slate-blue.jpg"},
  {id: "nvg-tee-forest-green", name: "NVG Tee (Forest Green)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/nvg-tee-forest-green.jpg"},
  {id: "radio-hoodie-black", name: "Radio Hoodie (Black)", price: 90, was: null, category: "Hoodies", soldOut: false, image: "/merch/radio-hoodie-black.jpg"},
  {id: "cybear-xl-mouse-pad", name: "Cybear XL Mouse Pad", price: 30, was: null, category: "Gear", soldOut: false, image: "/merch/cybear-xl-mouse-pad.jpg"},
  {id: "cybear-tee-black", name: "Cybear Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/cybear-tee-black.jpg"},
  {id: "cybear-hoodie-vintage-black", name: "Cybear Hoodie (Vintage Black)", price: 90, was: null, category: "Hoodies", soldOut: false, image: "/merch/cybear-hoodie-vintage-black.jpg"},
  {id: "world-tour-tee-black", name: "World Tour Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/world-tour-tee-black.jpg"},
  {id: "world-tour-tee-white", name: "World Tour Tee (White)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/world-tour-tee-white.jpg"},
  {id: "cafe-flanque-tee", name: "Café Flanqué Tee", price: 42, was: null, category: "Tees", soldOut: true, image: "/merch/cafe-flanque-tee.jpg"},
  {id: "tri-color-track-suit", name: "Tri Color Track Suit", price: 120, was: 150, category: "Outerwear", soldOut: false, image: "/merch/tri-color-track-suit.jpg"},
  {id: "tri-color-jersey", name: "Tri Color Jersey", price: 68, was: 85, category: "Jerseys", soldOut: false, image: "/merch/tri-color-jersey.jpg"},
  {id: "night-mode-3m-track-suit", name: "Night Mode 3M Track Suit", price: 150, was: null, category: "Outerwear", soldOut: false, image: "/merch/night-mode-3m-track-suit.jpg"},
  {id: "2026-stallions-jersey", name: "2026 Stallions Jersey", price: 80, was: null, category: "Jerseys", soldOut: false, image: "/merch/2026-stallions-jersey.jpg"},
  {id: "flank-tee-vintage-black", name: "Flank Tee (Vintage Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/flank-tee-vintage-black.jpg"},
  {id: "stallions-crest-tee-grey", name: "Stallions Crest Tee (Grey)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/stallions-crest-tee-grey.jpg"},
  {id: "stallions-college-tee", name: "Stallions College Tee", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/stallions-college-tee.jpg"},
  {id: "stallions-hoodie-black", name: "Stallions Hoodie (Black)", price: 90, was: null, category: "Hoodies", soldOut: false, image: "/merch/stallions-hoodie-black.jpg"},
  {id: "stallions-hoodie-mahogany", name: "Stallions Hoodie (Mahogany)", price: 90, was: null, category: "Hoodies", soldOut: false, image: "/merch/stallions-hoodie-mahogany.jpg"},
  {id: "flank-hoodie-black", name: "Flank Hoodie (Black)", price: 90, was: null, category: "Hoodies", soldOut: false, image: "/merch/flank-hoodie-black.jpg"},
  {id: "victory-flag-tee-black", name: "Victory Flag Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/victory-flag-tee-black.jpg"},
  {id: "victory-flag-tee-camo", name: "Victory Flag Tee (Camo)", price: 44, was: null, category: "Tees", soldOut: false, image: "/merch/victory-flag-tee-camo.jpg"},
  {id: "victory-flag-tee-wheat", name: "Victory Flag Tee (Wheat)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/victory-flag-tee-wheat.jpg"},
  {id: "battle-damage-tee-black", name: "Battle Damage Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/battle-damage-tee-black.jpg"},
  {id: "battle-damage-tee-grey", name: "Battle Damage Tee (Grey)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/battle-damage-tee-grey.jpg"},
  {id: "2026-esports-jersey", name: "2026 Esports Jersey", price: 80, was: null, category: "Jerseys", soldOut: false, image: "/merch/2026-esports-jersey.jpg"},
  {id: "2026-counter-strike-jersey", name: "2026 Counter Strike Jersey", price: 80, was: null, category: "Jerseys", soldOut: false, image: "/merch/2026-counter-strike-jersey.jpg"},
  {id: "distressed-jersey-hoodie", name: "Distressed Jersey Hoodie", price: 120, was: null, category: "Hoodies", soldOut: false, image: "/merch/distressed-jersey-hoodie.jpg"},
  {id: "jersey-tee-mineral-wash", name: "Jersey Tee (Mineral Wash)", price: 46, was: null, category: "Tees", soldOut: false, image: "/merch/jersey-tee-mineral-wash.jpg"},
  {id: "digi-camo-five-star-tee-black", name: "Digi Camo Five Star Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/digi-camo-five-star-tee-black.jpg"},
  {id: "digi-camo-five-star-tee-white", name: "Digi Camo Five Star Tee (White)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/digi-camo-five-star-tee-white.jpg"},
  {id: "retro-neon-five-star-tee-black", name: "Retro Neon Five Star Tee (Black)", price: 40, was: null, category: "Tees", soldOut: false, image: "/merch/retro-neon-five-star-tee-black.jpg"},
  {id: "retro-neon-five-star-tee-mahogany", name: "Retro Neon Five Star Tee (Mahogany)", price: 40, was: null, category: "Tees", soldOut: true, image: "/merch/retro-neon-five-star-tee-mahogany.jpg"},
  {id: "team-travel-duffel-bag", name: "Team Travel Duffel Bag", price: 75, was: 98, category: "Gear", soldOut: false, image: "/merch/team-travel-duffel-bag.jpg"},
  {id: "back-2-back-champions-tee", name: "Back 2 Back Champions Tee", price: 40, was: null, category: "Tees", soldOut: true, image: "/merch/back-2-back-champions-tee.jpg"},
  {id: "f-foam-finger", name: "F Foam Finger", price: 20, was: null, category: "Gear", soldOut: false, image: "/merch/f-foam-finger.jpg"},
  {id: "foam-finger-keychain", name: "Foam Finger Keychain", price: 7, was: null, category: "Gear", soldOut: false, image: "/merch/foam-finger-keychain.jpg"},
  {id: "four-star-ceramic-mug", name: "Four Star Ceramic Mug", price: 12, was: 20, category: "Gear", soldOut: false, image: "/merch/four-star-ceramic-mug.jpg"},
  {id: "four-star-trucker-hat-black", name: "Four Star Trucker Hat (Black)", price: 28, was: 42, category: "Hats", soldOut: false, image: "/merch/four-star-trucker-hat-black.jpg"},
  {id: "four-star-6-panel-hat-camo", name: "Four Star 6 Panel Hat (Camo)", price: 28, was: 42, category: "Hats", soldOut: false, image: "/merch/four-star-6-panel-hat-camo.jpg"},
  {id: "four-star-3d-snapback-black", name: "Four Star 3D Snapback (Black)", price: 25, was: 44, category: "Hats", soldOut: false, image: "/merch/four-star-3d-snapback-black.jpg"},
  {id: "four-star-3d-snapback-red", name: "Four Star 3D Snapback (Red)", price: 25, was: 44, category: "Hats", soldOut: false, image: "/merch/four-star-3d-snapback-red.jpg"},
  {id: "four-star-hoodie-black", name: "Four Star Hoodie (Black)", price: 88, was: 120, category: "Hoodies", soldOut: false, image: "/merch/four-star-hoodie-black.jpg"},
  {id: "four-star-hoodie-grey", name: "Four Star Hoodie (Grey)", price: 88, was: 120, category: "Hoodies", soldOut: false, image: "/merch/four-star-hoodie-grey.jpg"},
  {id: "four-star-zip-hoodie", name: "Four Star Zip Hoodie", price: 75, was: 95, category: "Hoodies", soldOut: false, image: "/merch/four-star-zip-hoodie.jpg"},
  {id: "four-star-crewneck-camo", name: "Four Star Crewneck (Camo)", price: 75, was: 95, category: "Hoodies", soldOut: false, image: "/merch/four-star-crewneck-camo.jpg"},
  {id: "four-star-left-chest-tee-black", name: "Four Star Left Chest Tee (Black)", price: 32, was: 40, category: "Tees", soldOut: true, image: "/merch/four-star-left-chest-tee-black.jpg"},
  {id: "four-star-left-chest-tee-white", name: "Four Star Left Chest Tee (White)", price: 32, was: 40, category: "Tees", soldOut: false, image: "/merch/four-star-left-chest-tee-white.jpg"},
  {id: "four-star-left-chest-tee-camo", name: "Four Star Left Chest Tee (Camo)", price: 36, was: 44, category: "Tees", soldOut: false, image: "/merch/four-star-left-chest-tee-camo.jpg"},
  {id: "four-star-tee-black", name: "Four Star Tee (Black)", price: 32, was: 40, category: "Tees", soldOut: false, image: "/merch/four-star-tee-black.jpg"},
  {id: "four-star-tee-white", name: "Four Star Tee (White)", price: 32, was: 40, category: "Tees", soldOut: false, image: "/merch/four-star-tee-white.jpg"},
  {id: "four-star-tee-grey", name: "Four Star Tee (Grey)", price: 32, was: 40, category: "Tees", soldOut: false, image: "/merch/four-star-tee-grey.jpg"},
  {id: "2025-esports-jersey", name: "2025 Esports Jersey", price: 80, was: null, category: "Jerseys", soldOut: false, image: "/merch/2025-esports-jersey.jpg"},
];

export const CATEGORIES = ['All', 'Jerseys', 'Tees', 'Hoodies', 'Outerwear', 'Hats', 'Gear'];
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const MAX_QTY = 10;
// Points rules. The API enforces these; they are repeated here only to show them (a test keeps the two in step).
export const POINTS_PER_BLOCK = 1000; // earned for every full $10 actually paid, after any discount code
export const BLOCK_CENTS = 1000;
export const SIGNATURE_POINTS = 15000; // per piece, paid from the points you already have
export const pointsEarned = (totalCents) => Math.floor(totalCents / BLOCK_CENTS) * POINTS_PER_BLOCK;
const SIZED = new Set(['Jerseys', 'Tees', 'Hoodies', 'Outerwear']);
export const isSized = (item) => SIZED.has(item.category);
