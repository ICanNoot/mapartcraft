// Colour conversion and matching utilities

import { ToneVariant, PaletteEntry } from '../types';

/**
 * Convert RGB to CIE Lab colour space for perceptual distance
 * Ported from MapartCraft's rgb2lab implementation
 */
export function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  // sRGB to linear
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  // Linear RGB to XYZ (D65 illuminant)
  let x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  let y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750;
  let z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

  const L = 116 * y - 16;
  const a = 500 * (x - y);
  const bVal = 200 * (y - z);

  return [L, a, bVal];
}

/**
 * Euclidean distance in RGB space
 */
export function rgbDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * CIE76 distance in Lab space
 */
export function labDistance(l1: [number, number, number], l2: [number, number, number]): number {
  const dl = l1[0] - l2[0];
  const da = l1[1] - l2[1];
  const db = l1[2] - l2[2];
  return dl * dl + da * da + db * db;
}

/**
 * Apply brightness, contrast, saturation to an RGB pixel
 */
export function applyPreProcessing(
  r: number, g: number, b: number,
  brightness: number, contrast: number, saturation: number
): [number, number, number] {
  // Brightness (-100 to 100)
  const bFactor = brightness / 100;
  r = r + bFactor * 255;
  g = g + bFactor * 255;
  b = b + bFactor * 255;

  // Contrast (-100 to 100)
  const cFactor = (contrast + 100) / 100;
  const cf = cFactor * cFactor;
  r = ((r / 255 - 0.5) * cf + 0.5) * 255;
  g = ((g / 255 - 0.5) * cf + 0.5) * 255;
  b = ((b / 255 - 0.5) * cf + 0.5) * 255;

  // Saturation (-100 to 100)
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sFactor = (saturation + 100) / 100;
  r = gray + sFactor * (r - gray);
  g = gray + sFactor * (g - gray);
  b = gray + sFactor * (b - gray);

  return [
    Math.max(0, Math.min(255, Math.round(r))),
    Math.max(0, Math.min(255, Math.round(g))),
    Math.max(0, Math.min(255, Math.round(b))),
  ];
}

/**
 * Find nearest palette entry to given RGB colour
 */
export function findNearestColour(
  r: number, g: number, b: number,
  palette: PaletteEntry[],
  useLab: boolean
): { index: number; entry: PaletteEntry } {
  let bestIndex = 0;
  let bestDist = Infinity;

  if (useLab) {
    const inputLab = rgb2lab(r, g, b);
    for (let i = 0; i < palette.length; i++) {
      const lab = palette[i].lab!;
      const dist = labDistance(inputLab, lab);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
  } else {
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i].rgb;
      const dist = rgbDistance(r, g, b, pr, pg, pb);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
  }

  return { index: bestIndex, entry: palette[bestIndex] };
}

/**
 * Build active palette from colour data based on settings
 */
export function buildPalette(
  coloursData: Record<string, any>,
  mapMode: 'flat' | 'staircase',
  carpetOnly: boolean,
  computeLab: boolean
): PaletteEntry[] {
  const palette: PaletteEntry[] = [];

  // Carpet colour set IDs (0-indexed keys in coloursJSON that correspond to carpet blocks)
  const carpetSetIds = new Set<number>();
  if (carpetOnly) {
    for (const [key, colourSet] of Object.entries(coloursData)) {
      const cs = colourSet as any;
      for (const block of Object.values(cs.blocks)) {
        const b = block as any;
        if (b.displayName && b.displayName.toLowerCase().includes('carpet') &&
            !b.displayName.toLowerCase().includes('moss')) {
          carpetSetIds.add(parseInt(key));
          break;
        }
      }
    }
  }

  for (const [key, colourSet] of Object.entries(coloursData)) {
    const csId = parseInt(key);
    const cs = colourSet as any;

    if (carpetOnly && !carpetSetIds.has(csId)) continue;

    const tones: ToneVariant[] = mapMode === 'flat'
      ? ['normal']
      : ['dark', 'normal', 'light']; // exclude unobtainable for staircase

    for (const tone of tones) {
      const rgb = cs.tonesRGB[tone] as [number, number, number];
      if (!rgb) continue;

      const entry: PaletteEntry = {
        colourSetId: csId,
        tone,
        rgb,
      };

      if (computeLab) {
        entry.lab = rgb2lab(rgb[0], rgb[1], rgb[2]);
      }

      palette.push(entry);
    }
  }

  return palette;
}
