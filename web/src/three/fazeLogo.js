// Outline of the FaZe Clan mark, traced from the official "No Stroke" brand PNG (15 corner points; the
// simplified polygon matches the bitmap to 99.9%). Units: height = 1, centred on the origin, y up.
// The mark has no holes, so one ring is enough. Re-trace from the brand file rather than editing by hand.
export const LOGO_ASPECT = 1.5124; // width / height

export const LOGO_OUTLINE = [
  [-0.7562, 0.5],
  [-0.5993, 0.3154],
  [-0.1211, 0.3154],
  [-0.1211, 0.2257],
  [-0.5227, 0.2257],
  [-0.3487, 0.0207],
  [-0.1211, 0.0207],
  [-0.1211, -0.5],
  [0.2121, -0.2107],
  [0.4218, -0.2107],
  [0.6377, 0.0053],
  [0.1206, 0.0053],
  [0.1206, 0.3154],
  [0.5721, 0.3154],
  [0.7562, 0.5],
];

// The same outline for SVG (y points down there): used as the poster when WebGL is unavailable.
export const LOGO_SVG_POINTS = LOGO_OUTLINE.map(([x, y]) => `${x},${-y}`).join(' ');
export const LOGO_SVG_VIEWBOX = `${-LOGO_ASPECT / 2} -0.5 ${LOGO_ASPECT} 1`;
