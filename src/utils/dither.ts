// Dithering algorithms for colour conversion

import { DitherMethod, PaletteEntry } from '../types';
import { findNearestColour, rgb2lab } from './colour';

interface DitherMatrix {
  matrix: number[][];
  divisor: number;
  type: 'error_diffusion' | 'ordered';
}

// Error diffusion matrices
const DITHER_MATRICES: Record<string, DitherMatrix> = {
  floyd_steinberg: {
    matrix: [
      [0, 0, 7],
      [3, 5, 1],
    ],
    divisor: 16,
    type: 'error_diffusion',
  },
  minavgerr: {
    matrix: [
      [0, 0, 7, 5],
      [3, 5, 7, 5],
      [1, 3, 5, 3],
    ],
    divisor: 48,
    type: 'error_diffusion',
  },
  burkes: {
    matrix: [
      [0, 0, 0, 8, 4],
      [2, 4, 8, 4, 2],
    ],
    divisor: 32,
    type: 'error_diffusion',
  },
  sierra_lite: {
    matrix: [
      [0, 0, 2],
      [1, 1, 0],
    ],
    divisor: 4,
    type: 'error_diffusion',
  },
  stucki: {
    matrix: [
      [0, 0, 0, 8, 4],
      [2, 4, 8, 4, 2],
      [1, 2, 4, 2, 1],
    ],
    divisor: 42,
    type: 'error_diffusion',
  },
  atkinson: {
    matrix: [
      [0, 0, 1, 1],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
    ],
    divisor: 8,
    type: 'error_diffusion',
  },
};

// Bayer threshold matrices
const BAYER_2X2 = [
  [0, 2],
  [3, 1],
];

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const ORDERED_3X3 = [
  [0, 7, 3],
  [6, 5, 2],
  [4, 1, 8],
];

/**
 * Apply dithering to image data and return palette-mapped result.
 * imageData: RGBA flat array (width*height*4)
 */
const TRANSPARENT_PIXEL = { colourSetId: -1, tone: 'normal' };

export function applyDithering(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  palette: PaletteEntry[],
  method: DitherMethod,
  useLab: boolean,
  transparencyEnabled: boolean = false,
  transparencyThreshold: number = 128,
): { colourSetId: number; tone: string }[] {
  const result: { colourSetId: number; tone: string }[] = new Array(width * height);

  if (method === 'none') {
    // Simple nearest colour
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (transparencyEnabled && imageData[idx + 3] < transparencyThreshold) {
          result[y * width + x] = TRANSPARENT_PIXEL;
          continue;
        }
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];
        const { entry } = findNearestColour(r, g, b, palette, useLab);
        result[y * width + x] = { colourSetId: entry.colourSetId, tone: entry.tone };
      }
    }
    return result;
  }

  // Ordered dithering (Bayer, Ordered)
  if (method === 'bayer_2x2' || method === 'bayer_4x4' || method === 'ordered_3x3') {
    const matrix = method === 'bayer_2x2' ? BAYER_2X2
      : method === 'bayer_4x4' ? BAYER_4X4
      : ORDERED_3X3;
    const size = matrix.length;
    const maxVal = size * size;

    // Find the two nearest colours and interpolate based on threshold
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (transparencyEnabled && imageData[idx + 3] < transparencyThreshold) {
          result[y * width + x] = TRANSPARENT_PIXEL;
          continue;
        }
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];

        const threshold = (matrix[y % size][x % size] + 0.5) / maxVal - 0.5;
        const factor = 64; // spread factor

        const dr = Math.max(0, Math.min(255, r + threshold * factor));
        const dg = Math.max(0, Math.min(255, g + threshold * factor));
        const db = Math.max(0, Math.min(255, b + threshold * factor));

        const { entry } = findNearestColour(dr, dg, db, palette, useLab);
        result[y * width + x] = { colourSetId: entry.colourSetId, tone: entry.tone };
      }
    }
    return result;
  }

  // Error diffusion dithering
  const dm = DITHER_MATRICES[method];
  if (!dm) {
    // Fallback to no dithering
    return applyDithering(imageData, width, height, palette, 'none', useLab);
  }

  // Working copy of image as float arrays
  const rBuf = new Float32Array(width * height);
  const gBuf = new Float32Array(width * height);
  const bBuf = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    rBuf[i] = imageData[i * 4];
    gBuf[i] = imageData[i * 4 + 1];
    bBuf[i] = imageData[i * 4 + 2];
  }

  // Find the position of the "current pixel" in the matrix (the first zero in row 0... actually the pixel being processed)
  const matrixRows = dm.matrix.length;
  const matrixCols = dm.matrix[0].length;
  // The current pixel is at the first row, at the position of the first 0 followed by non-zero
  let currentCol = 0;
  for (let c = 0; c < matrixCols; c++) {
    if (dm.matrix[0][c] !== 0) {
      currentCol = c - 1;
      break;
    }
    currentCol = c;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (transparencyEnabled && imageData[i * 4 + 3] < transparencyThreshold) {
        result[i] = TRANSPARENT_PIXEL;
        continue;
      }
      const r = Math.max(0, Math.min(255, rBuf[i]));
      const g = Math.max(0, Math.min(255, gBuf[i]));
      const b = Math.max(0, Math.min(255, bBuf[i]));

      const { entry } = findNearestColour(r, g, b, palette, useLab);
      result[i] = { colourSetId: entry.colourSetId, tone: entry.tone };

      // Compute error
      const errR = r - entry.rgb[0];
      const errG = g - entry.rgb[1];
      const errB = b - entry.rgb[2];

      // Distribute error
      for (let mr = 0; mr < matrixRows; mr++) {
        for (let mc = 0; mc < matrixCols; mc++) {
          const weight = dm.matrix[mr][mc];
          if (weight === 0) continue;

          const nx = x + mc - currentCol;
          const ny = y + mr;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = ny * width + nx;
            const factor = weight / dm.divisor;
            rBuf[ni] += errR * factor;
            gBuf[ni] += errG * factor;
            bBuf[ni] += errB * factor;
          }
        }
      }
    }
  }

  return result;
}
