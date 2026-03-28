// Canvas-based pixel editor with zoom, pan, tool interaction, split view, and difference overlay

import React, { useRef, useEffect, useCallback } from 'react';
import {
  ProjectState, ToolType, ToneVariant, SelectionRect, CanvasBackground,
  MAP_SIZE, EMPTY_PIXEL, encodePixel, decodePixel,
} from '../../types';

const BACKGROUND_COLOURS: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  mid_grey: [128, 128, 128],
  dark_grey: [64, 64, 64],
  black: [0, 0, 0],
};

function parseHexColour(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

interface PixelCanvasProps {
  project: ProjectState;
  coloursData: Record<string, any>;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showMapBorders: boolean;
  activeTool: ToolType;
  brushSize: number;
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  selection: SelectionRect | null;
  canvasBackground: CanvasBackground;
  customBackgroundColour: string;
  showBeforeAfter: boolean;
  splitViewMode: boolean;
  splitViewPosition: number;
  showDifferenceOverlay: boolean;
  onZoomChange: (zoom: number) => void;
  onPanChange: (x: number, y: number) => void;
  onCursorChange: (x: number, y: number) => void;
  onPixelsBatch: (changes: { x: number; y: number; encoded: number }[]) => void;
  onCommitPixels: (description: string) => void;
  onFill: (x: number, y: number, colourSetId: number, tone: ToneVariant) => void;
  onEyedrop: (colourSetId: number, tone: ToneVariant) => void;
  onSelectionChange: (sel: SelectionRect | null) => void;
  onContextMenu: (x: number, y: number) => void;
  onSplitPositionChange: (pos: number) => void;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({
  project, coloursData, zoom, panX, panY,
  showGrid, showMapBorders, activeTool, brushSize,
  selectedColourSetId, selectedTone, selection,
  canvasBackground, customBackgroundColour,
  showBeforeAfter, splitViewMode, splitViewPosition, showDifferenceOverlay,
  onZoomChange, onPanChange, onCursorChange,
  onPixelsBatch, onCommitPixels, onFill, onEyedrop,
  onSelectionChange, onContextMenu, onSplitPositionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const isDrawing = useRef(false);
  const isSelecting = useRef(false);
  const isDraggingSplit = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const spaceHeld = useRef(false);
  const ctrlHeld = useRef(false);
  const shiftHeld = useRef(false);
  const rafId = useRef<number>(0);
  const needsRedraw = useRef(true);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diffCacheRef = useRef<{ imgData: ImageData; startPxX: number; startPxY: number; imgW: number; imgH: number } | null>(null);
  const diffCacheDirty = useRef(true);
  const pixelBufferRef = useRef<ImageData | null>(null);
  const pixelBufferDims = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const cursorPixelRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 });

  // Track previous tool for Ctrl+click eyedropper
  const prevToolRef = useRef<ToolType>(activeTool);
  const tempEyedropRef = useRef(false);

  // Refs for render loop access (updated by props, read inside rAF)
  const projectRef = useRef(project);
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const showGridRef = useRef(showGrid);
  const showMapBordersRef = useRef(showMapBorders);
  const selectionRef = useRef(selection);
  const canvasBackgroundRef = useRef(canvasBackground);
  const customBackgroundColourRef = useRef(customBackgroundColour);
  const showBeforeAfterRef = useRef(showBeforeAfter);
  const splitViewModeRef = useRef(splitViewMode);
  const splitViewPositionRef = useRef(splitViewPosition);
  const showDifferenceOverlayRef = useRef(showDifferenceOverlay);
  const activeToolRef = useRef(activeTool);

  // Precompute colour lookup from coloursData
  const colourLookup = useRef<Map<number, [number, number, number]>>(new Map());

  useEffect(() => {
    if (!coloursData) return;
    const lookup = new Map<number, [number, number, number]>();
    for (const [key, cs] of Object.entries(coloursData)) {
      const csId = parseInt(key);
      const tones = ['dark', 'normal', 'light', 'unobtainable'] as const;
      for (let ti = 0; ti < tones.length; ti++) {
        const rgb = (cs as any).tonesRGB[tones[ti]];
        if (rgb) {
          lookup.set(csId * 4 + ti, rgb);
        }
      }
    }
    colourLookup.current = lookup;
    needsRedraw.current = true;
  }, [coloursData]);

  // Sync refs with props
  useEffect(() => {
    projectRef.current = project;
    zoomRef.current = zoom;
    panXRef.current = panX;
    panYRef.current = panY;
    showGridRef.current = showGrid;
    showMapBordersRef.current = showMapBorders;
    selectionRef.current = selection;
    canvasBackgroundRef.current = canvasBackground;
    customBackgroundColourRef.current = customBackgroundColour;
    showBeforeAfterRef.current = showBeforeAfter;
    splitViewModeRef.current = splitViewMode;
    splitViewPositionRef.current = splitViewPosition;
    showDifferenceOverlayRef.current = showDifferenceOverlay;
    activeToolRef.current = activeTool;
  });

  // Mark diff cache dirty when pixel data or source image changes
  useEffect(() => {
    diffCacheDirty.current = true;
  }, [project.pixels, project.sourceImageData]);

  // Cache original (full-res) image as canvas for split view / before-after
  useEffect(() => {
    const imgData = project.originalImageData ?? project.sourceImageData;
    if (!imgData) {
      srcCanvasRef.current = null;
      return;
    }
    const c = document.createElement('canvas');
    c.width = imgData.width;
    c.height = imgData.height;
    c.getContext('2d')!.putImageData(imgData, 0, 0);
    srcCanvasRef.current = c;
  }, [project.originalImageData, project.sourceImageData]);

  // Mark for redraw when relevant state changes
  useEffect(() => {
    needsRedraw.current = true;
  }, [project.pixels, zoom, panX, panY, showGrid, showMapBorders, selection,
      canvasBackground, customBackgroundColour, showBeforeAfter, splitViewMode,
      splitViewPosition, showDifferenceOverlay]);

  // Main render loop — set up once on mount, reads current values from refs
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !overlay || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false })!;
    const octx = overlay.getContext('2d')!;

    const render = () => {
      rafId.current = requestAnimationFrame(render);

      if (!needsRedraw.current) return;
      needsRedraw.current = false;

      const cw = container.clientWidth;
      const ch = container.clientHeight;

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        overlay.width = cw;
        overlay.height = ch;
      }

      // Read current values from refs
      const curProject = projectRef.current;
      const curZoom = zoomRef.current;
      const curPanX = panXRef.current;
      const curPanY = panYRef.current;
      const curShowGrid = showGridRef.current;
      const curShowMapBorders = showMapBordersRef.current;
      const curSelection = selectionRef.current;
      const curCanvasBackground = canvasBackgroundRef.current;
      const curCustomBackgroundColour = customBackgroundColourRef.current;
      const curShowBeforeAfter = showBeforeAfterRef.current;
      const curSplitViewMode = splitViewModeRef.current;
      const curSplitViewPosition = splitViewPositionRef.current;
      const curShowDifferenceOverlay = showDifferenceOverlayRef.current;
      const curActiveTool = activeToolRef.current;
      const curCursorPixel = cursorPixelRef.current;

      // Clear
      ctx.fillStyle = '#1a1917';
      ctx.fillRect(0, 0, cw, ch);
      octx.clearRect(0, 0, cw, ch);

      const { pixelWidth, pixelHeight, pixels } = curProject;

      // Calculate visible region
      const offsetX = cw / 2 + curPanX;
      const offsetY = ch / 2 + curPanY;
      const startPxX = Math.max(0, Math.floor(-offsetX / curZoom));
      const startPxY = Math.max(0, Math.floor(-offsetY / curZoom));
      const endPxX = Math.min(pixelWidth, Math.ceil((cw - offsetX) / curZoom));
      const endPxY = Math.min(pixelHeight, Math.ceil((ch - offsetY) / curZoom));

      const lookup = colourLookup.current;
      const imgW = endPxX - startPxX;
      const imgH = endPxY - startPxY;

      // Determine whether to show source image
      const showSource = curShowBeforeAfter && srcCanvasRef.current;

      if (imgW > 0 && imgH > 0) {
        // Compute background
        const isCheckerboard = curCanvasBackground === 'checkerboard';
        const checkerSize = Math.max(1, Math.round(8 / curZoom));
        let bgR = 26, bgG = 25, bgB = 23;
        if (!isCheckerboard) {
          if (curCanvasBackground === 'custom') {
            const [cr, cg, cb] = parseHexColour(curCustomBackgroundColour);
            bgR = cr; bgG = cg; bgB = cb;
          } else if (BACKGROUND_COLOURS[curCanvasBackground]) {
            [bgR, bgG, bgB] = BACKGROUND_COLOURS[curCanvasBackground];
          }
        }

        // Helper: render pixel buffer (reuses ImageData when dimensions unchanged)
        const renderPixels = (sourceImageData?: ImageData | null): ImageData => {
          // Reuse pixel buffer if dimensions match
          if (pixelBufferDims.current.w !== imgW || pixelBufferDims.current.h !== imgH || !pixelBufferRef.current) {
            pixelBufferRef.current = ctx.createImageData(imgW, imgH);
            pixelBufferDims.current = { w: imgW, h: imgH };
          }
          const imgData = pixelBufferRef.current;
          const data = imgData.data;
          const srcData = sourceImageData?.data;
          const srcW = sourceImageData?.width ?? 0;

          for (let py = 0; py < imgH; py++) {
            for (let px = 0; px < imgW; px++) {
              const idx = (py * imgW + px) * 4;
              const worldX = startPxX + px;
              const worldY = startPxY + py;

              if (srcData && worldX < srcW && worldY < (sourceImageData?.height ?? 0)) {
                const si = (worldY * srcW + worldX) * 4;
                data[idx] = srcData[si];
                data[idx + 1] = srcData[si + 1];
                data[idx + 2] = srcData[si + 2];
                data[idx + 3] = 255;
              } else {
                const encoded = pixels[worldY * pixelWidth + worldX];
                if (encoded === EMPTY_PIXEL) {
                  if (isCheckerboard) {
                    const cx = Math.floor(worldX / checkerSize);
                    const cy = Math.floor(worldY / checkerSize);
                    const light = (cx + cy) % 2 === 0;
                    data[idx] = light ? 204 : 153;
                    data[idx + 1] = light ? 204 : 153;
                    data[idx + 2] = light ? 204 : 153;
                  } else {
                    data[idx] = bgR; data[idx + 1] = bgG; data[idx + 2] = bgB;
                  }
                  data[idx + 3] = 255;
                } else {
                  const rgb = lookup.get(encoded);
                  if (rgb) {
                    data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
                  } else {
                    data[idx] = bgR; data[idx + 1] = bgG; data[idx + 2] = bgB; data[idx + 3] = 255;
                  }
                }
              }
            }
          }
          return imgData;
        };

        // Reuse temp canvas
        if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
        const tempCanvas = tempCanvasRef.current;
        if (tempCanvas.width !== imgW || tempCanvas.height !== imgH) {
          tempCanvas.width = imgW;
          tempCanvas.height = imgH;
        }
        const tempCtx = tempCanvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        const dx = Math.floor(offsetX + startPxX * curZoom);
        const dy = Math.floor(offsetY + startPxY * curZoom);
        const dw = Math.ceil(imgW * curZoom);
        const dh = Math.ceil(imgH * curZoom);

        // Helper: draw source image with smooth scaling from full-res original
        const drawSourceSmooth = () => {
          if (!srcCanvasRef.current) return;
          const srcC = srcCanvasRef.current;
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          const imgDx = Math.floor(offsetX);
          const imgDy = Math.floor(offsetY);
          const imgDw = Math.ceil(pixelWidth * curZoom);
          const imgDh = Math.ceil(pixelHeight * curZoom);
          ctx.drawImage(srcC, 0, 0, srcC.width, srcC.height, imgDx, imgDy, imgDw, imgDh);
          ctx.restore();
        };

        if (showSource && !curSplitViewMode) {
          drawSourceSmooth();
        } else if (curSplitViewMode && srcCanvasRef.current) {
          const splitScreenX = cw * curSplitViewPosition;

          const convertedData = renderPixels(null);
          tempCtx.putImageData(convertedData, 0, 0);
          ctx.drawImage(tempCanvas, dx, dy, dw, dh);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, splitScreenX, ch);
          ctx.clip();
          drawSourceSmooth();
          ctx.restore();

          octx.strokeStyle = 'var(--accent)';
          octx.lineWidth = 2;
          octx.beginPath();
          octx.moveTo(splitScreenX, 0);
          octx.lineTo(splitScreenX, ch);
          octx.stroke();

          octx.fillStyle = 'rgba(232, 220, 200, 0.8)';
          octx.beginPath();
          octx.roundRect(splitScreenX - 8, ch / 2 - 20, 16, 40, 4);
          octx.fill();
        } else {
          const imgData = renderPixels(null);
          tempCtx.putImageData(imgData, 0, 0);
          ctx.drawImage(tempCanvas, dx, dy, dw, dh);
        }

        // Difference overlay — cached, only recomputed when data changes
        if (curShowDifferenceOverlay && curProject.sourceImageData && !showSource) {
          // Reuse diff canvas
          if (!diffCanvasRef.current) diffCanvasRef.current = document.createElement('canvas');
          const diffCanvas = diffCanvasRef.current;

          // Recompute only when dirty
          if (diffCacheDirty.current) {
            diffCacheDirty.current = false;

            // Compute over the full pixel area (not just visible region) for cache stability
            const fullW = pixelWidth;
            const fullH = pixelHeight;

            if (diffCanvas.width !== fullW || diffCanvas.height !== fullH) {
              diffCanvas.width = fullW;
              diffCanvas.height = fullH;
            }

            const srcData = curProject.sourceImageData.data;
            const srcW = curProject.sourceImageData.width;
            const srcH = curProject.sourceImageData.height;

            // First pass: compute distances and find actual max
            const totalPixels = fullW * fullH;
            const distances = new Float32Array(totalPixels);
            let actualMax = 0;

            for (let py = 0; py < fullH; py++) {
              for (let px = 0; px < fullW; px++) {
                const di = py * fullW + px;

                if (px >= srcW || py >= srcH) { distances[di] = -1; continue; }

                const encoded = pixels[py * pixelWidth + px];
                const rgb = encoded !== EMPTY_PIXEL ? lookup.get(encoded) : null;
                if (!rgb) { distances[di] = -1; continue; }

                const si = (py * srcW + px) * 4;
                const dr = srcData[si] - rgb[0], dg = srcData[si + 1] - rgb[1], db = srcData[si + 2] - rgb[2];
                const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                distances[di] = dist;
                if (dist > actualMax) actualMax = dist;
              }
            }

            // Second pass: render heatmap with threshold
            const diffImgData = ctx.createImageData(fullW, fullH);
            const diffData = diffImgData.data;
            const threshold = actualMax * 0.05;

            for (let py = 0; py < fullH; py++) {
              for (let px = 0; px < fullW; px++) {
                const idx = (py * fullW + px) * 4;
                const dist = distances[py * fullW + px];

                if (dist < 0 || dist <= threshold) {
                  diffData[idx + 3] = 0;
                  continue;
                }

                const t = actualMax > threshold ? (dist - threshold) / (actualMax - threshold) : 0;

                let r: number, g: number, b: number;
                if (t < 0.5) {
                  const s = t * 2;
                  r = 255;
                  g = Math.round(220 - s * 80);
                  b = Math.round(50 - s * 30);
                } else {
                  const s = (t - 0.5) * 2;
                  r = 255;
                  g = Math.round(140 - s * 110);
                  b = Math.round(20 - s * 10);
                }

                const alpha = Math.min(255, Math.round(80 + t * 175));
                diffData[idx] = r;
                diffData[idx + 1] = g;
                diffData[idx + 2] = b;
                diffData[idx + 3] = alpha;
              }
            }

            diffCanvas.getContext('2d')!.putImageData(diffImgData, 0, 0);
          }

          // Draw cached diff overlay (just a drawImage, very fast)
          ctx.globalAlpha = 0.7;
          ctx.imageSmoothingEnabled = false;
          const fullDx = Math.floor(offsetX);
          const fullDy = Math.floor(offsetY);
          const fullDw = Math.ceil(pixelWidth * curZoom);
          const fullDh = Math.ceil(pixelHeight * curZoom);
          ctx.drawImage(diffCanvas, fullDx, fullDy, fullDw, fullDh);
          ctx.globalAlpha = 1;
        }
      }

      // Draw canvas border
      ctx.strokeStyle = '#454240';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.floor(offsetX), Math.floor(offsetY),
        Math.ceil(pixelWidth * curZoom), Math.ceil(pixelHeight * curZoom)
      );

      // Grid lines
      if (curShowGrid && curZoom >= 8) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let px = startPxX; px <= endPxX; px++) {
          const sx = Math.floor(offsetX + px * curZoom) + 0.5;
          ctx.moveTo(sx, Math.floor(offsetY + startPxY * curZoom));
          ctx.lineTo(sx, Math.floor(offsetY + endPxY * curZoom));
        }
        for (let py = startPxY; py <= endPxY; py++) {
          const sy = Math.floor(offsetY + py * curZoom) + 0.5;
          ctx.moveTo(Math.floor(offsetX + startPxX * curZoom), sy);
          ctx.lineTo(Math.floor(offsetX + endPxX * curZoom), sy);
        }
        ctx.stroke();
      }

      // Map borders
      if (curShowMapBorders) {
        octx.strokeStyle = '#c47a4a';
        octx.lineWidth = curZoom >= 2 ? 2 : 1;
        octx.setLineDash([]);
        for (let mx = 0; mx <= Math.ceil(pixelWidth / MAP_SIZE); mx++) {
          const sx = Math.floor(offsetX + mx * MAP_SIZE * curZoom) + 0.5;
          octx.beginPath();
          octx.moveTo(sx, Math.floor(offsetY));
          octx.lineTo(sx, Math.floor(offsetY + pixelHeight * curZoom));
          octx.stroke();
        }
        for (let my = 0; my <= Math.ceil(pixelHeight / MAP_SIZE); my++) {
          const sy = Math.floor(offsetY + my * MAP_SIZE * curZoom) + 0.5;
          octx.beginPath();
          octx.moveTo(Math.floor(offsetX), sy);
          octx.lineTo(Math.floor(offsetX + pixelWidth * curZoom), sy);
          octx.stroke();
        }
      }

      // Selection overlay
      if (curSelection) {
        octx.fillStyle = 'rgba(232, 220, 200, 0.2)';
        octx.strokeStyle = '#e8dcc8';
        octx.lineWidth = 1;
        octx.setLineDash([4, 4]);

        const sx = Math.floor(offsetX + curSelection.x * curZoom);
        const sy = Math.floor(offsetY + curSelection.y * curZoom);
        const sw = Math.ceil(curSelection.width * curZoom);
        const sh = Math.ceil(curSelection.height * curZoom);

        octx.fillRect(sx, sy, sw, sh);
        octx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);
        octx.setLineDash([]);
      }

      // Shift+draw preview line
      if (shiftHeld.current && lastDrawPos.current && curCursorPixel.x >= 0 &&
          (curActiveTool === 'pencil' || curActiveTool === 'eraser')) {
        const fromX = Math.floor(offsetX + (lastDrawPos.current.x + 0.5) * curZoom);
        const fromY = Math.floor(offsetY + (lastDrawPos.current.y + 0.5) * curZoom);
        const toX = Math.floor(offsetX + (curCursorPixel.x + 0.5) * curZoom);
        const toY = Math.floor(offsetY + (curCursorPixel.y + 0.5) * curZoom);
        octx.strokeStyle = 'rgba(232, 220, 200, 0.5)';
        octx.lineWidth = 1;
        octx.setLineDash([4, 4]);
        octx.beginPath();
        octx.moveTo(fromX, fromY);
        octx.lineTo(toX, toY);
        octx.stroke();
        octx.setLineDash([]);
      }
    };

    rafId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert screen coords to pixel coords
  const screenToPixel = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: -1, y: -1 };
    const rect = container.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const offsetX = container.clientWidth / 2 + panX;
    const offsetY = container.clientHeight / 2 + panY;
    const px = Math.floor((sx - offsetX) / zoom);
    const py = Math.floor((sy - offsetY) / zoom);
    return { x: px, y: py };
  }, [panX, panY, zoom]);

  // Draw brush at position
  const drawBrush = useCallback((px: number, py: number, erase: boolean) => {
    if (!project) return;
    const changes: { x: number; y: number; encoded: number }[] = [];
    const half = Math.floor(brushSize / 2);
    const encoded = erase ? EMPTY_PIXEL : encodePixel(selectedColourSetId, selectedTone);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = px + dx;
        const y = py + dy;
        if (x >= 0 && x < project.pixelWidth && y >= 0 && y < project.pixelHeight) {
          changes.push({ x, y, encoded });
        }
      }
    }

    if (changes.length > 0) {
      onPixelsBatch(changes);
      needsRedraw.current = true;
    }
  }, [project, brushSize, selectedColourSetId, selectedTone, onPixelsBatch]);

  // Draw line between two points
  const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number, erase: boolean) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    const changes: { x: number; y: number; encoded: number }[] = [];
    const half = Math.floor(brushSize / 2);
    const encoded = erase ? EMPTY_PIXEL : encodePixel(selectedColourSetId, selectedTone);

    let cx = x0, cy = y0;
    while (true) {
      for (let bdy = -half; bdy <= half; bdy++) {
        for (let bdx = -half; bdx <= half; bdx++) {
          const x = cx + bdx;
          const y = cy + bdy;
          if (x >= 0 && x < project.pixelWidth && y >= 0 && y < project.pixelHeight) {
            changes.push({ x, y, encoded });
          }
        }
      }

      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }

    if (changes.length > 0) {
      onPixelsBatch(changes);
      needsRedraw.current = true;
    }
  }, [project, brushSize, selectedColourSetId, selectedTone, onPixelsBatch]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x: px, y: py } = screenToPixel(e.clientX, e.clientY);

    // Middle click or space+click: pan
    if (e.button === 1 || spaceHeld.current) {
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // Check if clicking on split divider
    if (splitViewMode && e.button === 0) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const splitX = container.clientWidth * splitViewPosition;
        if (Math.abs(sx - splitX) < 12) {
          isDraggingSplit.current = true;
          e.preventDefault();
          return;
        }
      }
    }

    if (e.button !== 0) return;

    // Ctrl+click = temporary eyedropper
    if (ctrlHeld.current && activeTool !== 'eyedropper') {
      if (px >= 0 && px < project.pixelWidth && py >= 0 && py < project.pixelHeight) {
        const encoded = project.pixels[py * project.pixelWidth + px];
        const decoded = decodePixel(encoded);
        if (decoded) {
          onEyedrop(decoded.colourSetId, decoded.tone);
        }
      }
      tempEyedropRef.current = true;
      return;
    }

    // Shift+click for straight line from last drawn point
    if (shiftHeld.current && lastDrawPos.current &&
        (activeTool === 'pencil' || activeTool === 'eraser')) {
      const erase = activeTool === 'eraser';
      drawLine(lastDrawPos.current.x, lastDrawPos.current.y, px, py, erase);
      lastDrawPos.current = { x: px, y: py };
      onCommitPixels(erase ? 'Erase line' : 'Draw line');
      return;
    }

    switch (activeTool) {
      case 'pencil':
        isDrawing.current = true;
        lastDrawPos.current = { x: px, y: py };
        drawBrush(px, py, false);
        break;
      case 'eraser':
        isDrawing.current = true;
        lastDrawPos.current = { x: px, y: py };
        drawBrush(px, py, true);
        break;
      case 'eyedropper': {
        if (px >= 0 && px < project.pixelWidth && py >= 0 && py < project.pixelHeight) {
          const encoded = project.pixels[py * project.pixelWidth + px];
          const decoded = decodePixel(encoded);
          if (decoded) {
            onEyedrop(decoded.colourSetId, decoded.tone);
          }
        }
        break;
      }
      case 'fill':
        if (px >= 0 && px < project.pixelWidth && py >= 0 && py < project.pixelHeight) {
          onFill(px, py, selectedColourSetId, selectedTone);
        }
        break;
      case 'selection':
        isSelecting.current = true;
        selectionStart.current = { x: px, y: py };
        onSelectionChange(null);
        break;
    }
  }, [screenToPixel, activeTool, drawBrush, drawLine, project, selectedColourSetId, selectedTone,
      onFill, onEyedrop, onSelectionChange, onCommitPixels, splitViewMode, splitViewPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x: px, y: py } = screenToPixel(e.clientX, e.clientY);
    onCursorChange(px, py);
    cursorPixelRef.current = { x: px, y: py };

    // Split divider drag
    if (isDraggingSplit.current) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / container.clientWidth;
        onSplitPositionChange(pos);
      }
      return;
    }

    if (isPanning.current) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      onPanChange(panX + dx, panY + dy);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (isDrawing.current && lastDrawPos.current) {
      const erase = activeTool === 'eraser';
      drawLine(lastDrawPos.current.x, lastDrawPos.current.y, px, py, erase);
      lastDrawPos.current = { x: px, y: py };
    }

    if (isSelecting.current && selectionStart.current) {
      const sx = Math.min(selectionStart.current.x, px);
      const sy = Math.min(selectionStart.current.y, py);
      const sw = Math.abs(px - selectionStart.current.x) + 1;
      const sh = Math.abs(py - selectionStart.current.y) + 1;
      onSelectionChange({ x: sx, y: sy, width: sw, height: sh });
    }

    // Shift+draw preview needs redraw
    if (shiftHeld.current && lastDrawPos.current && (activeTool === 'pencil' || activeTool === 'eraser')) {
      needsRedraw.current = true;
    }
  }, [screenToPixel, panX, panY, activeTool, project, drawLine, onCursorChange, onPanChange,
      onSelectionChange, onSplitPositionChange]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingSplit.current) {
      isDraggingSplit.current = false;
      return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (isDrawing.current) {
      isDrawing.current = false;
      onCommitPixels(activeTool === 'eraser' ? 'Erase' : 'Draw');
    }

    if (isSelecting.current) {
      isSelecting.current = false;
      selectionStart.current = null;
    }

    if (tempEyedropRef.current) {
      tempEyedropRef.current = false;
    }
  }, [activeTool, onCommitPixels]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (isPanning.current) return;

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.1, Math.min(64, zoom * factor));

    // Zoom toward cursor
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;

      const worldX = (mx - cx - panX) / zoom;
      const worldY = (my - cy - panY) / zoom;

      const newPanX = mx - cx - worldX * newZoom;
      const newPanY = my - cy - worldY * newZoom;

      onPanChange(newPanX, newPanY);
    }

    onZoomChange(newZoom);
  }, [zoom, panX, panY, onZoomChange, onPanChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e.clientX, e.clientY);
  }, [onContextMenu]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeld.current = true;
        e.preventDefault();
      }
      if (e.key === 'Control') ctrlHeld.current = true;
      if (e.key === 'Shift') {
        shiftHeld.current = true;
        needsRedraw.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false;
      if (e.key === 'Control') ctrlHeld.current = false;
      if (e.key === 'Shift') {
        shiftHeld.current = false;
        needsRedraw.current = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const cursorStyle = spaceHeld.current || isPanning.current ? 'grab'
    : ctrlHeld.current ? 'crosshair'
    : isDraggingSplit.current ? 'col-resize'
    : 'crosshair';

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isPanning.current = false; isDrawing.current = false; isDraggingSplit.current = false; }}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      <canvas ref={canvasRef} />
      <canvas ref={overlayRef} style={{ pointerEvents: 'none' }} />
    </div>
  );
};
