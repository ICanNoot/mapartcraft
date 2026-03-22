// Image import and processing utilities

import { ResizeAlgorithm } from '../types';

/**
 * Load an image from a File object
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

/**
 * Resize image to target dimensions using canvas
 */
export function resizeImage(
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  algorithm: ResizeAlgorithm
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Set image smoothing based on algorithm
  if (algorithm === 'nearest') {
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = algorithm === 'lanczos' ? 'high' : 'medium';
  }

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Apply preprocessing to image data in-place
 */
export function applyPreprocessing(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number
): ImageData {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    const bFactor = brightness / 100;
    r = r + bFactor * 255;
    g = g + bFactor * 255;
    b = b + bFactor * 255;

    // Contrast
    const cFactor = (contrast + 100) / 100;
    const cf = cFactor * cFactor;
    r = ((r / 255 - 0.5) * cf + 0.5) * 255;
    g = ((g / 255 - 0.5) * cf + 0.5) * 255;
    b = ((b / 255 - 0.5) * cf + 0.5) * 255;

    // Saturation
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sFactor = (saturation + 100) / 100;
    r = gray + sFactor * (r - gray);
    g = gray + sFactor * (g - gray);
    b = gray + sFactor * (b - gray);

    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }

  return imageData;
}

/**
 * Calculate default map dimensions from image aspect ratio
 */
export function calculateDefaultMapSize(
  imgWidth: number,
  imgHeight: number,
  maxMaps: number = 10
): { mapWidth: number; mapHeight: number } {
  const aspect = imgWidth / imgHeight;

  // Try different sizes, find best fit
  let bestW = 1, bestH = 1;
  let bestDiff = Infinity;

  for (let w = 1; w <= maxMaps; w++) {
    for (let h = 1; h <= maxMaps; h++) {
      const mapAspect = w / h;
      const diff = Math.abs(mapAspect - aspect);
      const totalMaps = w * h;

      // Prefer smaller total maps with good aspect ratio match
      if (diff < bestDiff || (diff === bestDiff && totalMaps < bestW * bestH)) {
        bestDiff = diff;
        bestW = w;
        bestH = h;
      }

      // Stop if perfect match
      if (diff < 0.05) break;
    }
    if (bestDiff < 0.05) break;
  }

  return { mapWidth: bestW, mapHeight: bestH };
}
