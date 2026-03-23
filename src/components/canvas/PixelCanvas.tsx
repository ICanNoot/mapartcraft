// Canvas-based pixel editor with zoom, pan, and tool interaction

import React, { useRef, useEffect, useCallback, useState } from 'react';
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
  onZoomChange: (zoom: number) => void;
  onPanChange: (x: number, y: number) => void;
  onCursorChange: (x: number, y: number) => void;
  onPixelsBatch: (changes: { x: number; y: number; encoded: number }[]) => void;
  onCommitPixels: (description: string) => void;
  onFill: (x: number, y: number, colourSetId: number, tone: ToneVariant) => void;
  onEyedrop: (colourSetId: number, tone: ToneVariant) => void;
  onSelectionChange: (sel: SelectionRect | null) => void;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({
  project, coloursData, zoom, panX, panY,
  showGrid, showMapBorders, activeTool, brushSize,
  selectedColourSetId, selectedTone, selection,
  canvasBackground, customBackgroundColour,
  onZoomChange, onPanChange, onCursorChange,
  onPixelsBatch, onCommitPixels, onFill, onEyedrop,
  onSelectionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const isDrawing = useRef(false);
  const isSelecting = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const spaceHeld = useRef(false);
  const rafId = useRef<number>(0);
  const needsRedraw = useRef(true);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Mark for redraw when relevant state changes
  useEffect(() => {
    needsRedraw.current = true;
  }, [project.pixels, zoom, panX, panY, showGrid, showMapBorders, selection, canvasBackground, customBackgroundColour]);

  // Main render loop
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

      // Clear
      ctx.fillStyle = '#111122';
      ctx.fillRect(0, 0, cw, ch);
      octx.clearRect(0, 0, cw, ch);

      const { pixelWidth, pixelHeight, pixels } = project;

      // Calculate visible region
      const offsetX = cw / 2 + panX;
      const offsetY = ch / 2 + panY;
      const startPxX = Math.max(0, Math.floor(-offsetX / zoom));
      const startPxY = Math.max(0, Math.floor(-offsetY / zoom));
      const endPxX = Math.min(pixelWidth, Math.ceil((cw - offsetX) / zoom));
      const endPxY = Math.min(pixelHeight, Math.ceil((ch - offsetY) / zoom));

      // Draw pixels using ImageData buffer at all zoom levels
      const lookup = colourLookup.current;
      const imgW = endPxX - startPxX;
      const imgH = endPxY - startPxY;
      if (imgW > 0 && imgH > 0) {
        const imgData = ctx.createImageData(imgW, imgH);
        const data = imgData.data;

        // Compute background colours for empty pixels
        const isCheckerboard = canvasBackground === 'checkerboard';
        // Checkerboard: 8x8 screen-pixel squares, so size in map-pixels depends on zoom
        const checkerSize = Math.max(1, Math.round(8 / zoom));
        let bgR = 17, bgG = 17, bgB = 34;
        if (!isCheckerboard) {
          if (canvasBackground === 'custom') {
            const [cr, cg, cb] = parseHexColour(customBackgroundColour);
            bgR = cr; bgG = cg; bgB = cb;
          } else if (BACKGROUND_COLOURS[canvasBackground]) {
            [bgR, bgG, bgB] = BACKGROUND_COLOURS[canvasBackground];
          }
        }

        for (let py = 0; py < imgH; py++) {
          for (let px = 0; px < imgW; px++) {
            const encoded = pixels[(startPxY + py) * pixelWidth + (startPxX + px)];
            const idx = (py * imgW + px) * 4;
            if (encoded === EMPTY_PIXEL) {
              if (isCheckerboard) {
                const cx = Math.floor((startPxX + px) / checkerSize);
                const cy = Math.floor((startPxY + py) / checkerSize);
                const light = (cx + cy) % 2 === 0;
                data[idx] = light ? 204 : 153;
                data[idx + 1] = light ? 204 : 153;
                data[idx + 2] = light ? 204 : 153;
              } else {
                data[idx] = bgR; data[idx + 1] = bgG; data[idx + 2] = bgB;
              }
              data[idx + 3] = 255;
              continue;
            }
            const rgb = lookup.get(encoded);
            if (rgb) {
              data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
            } else {
              data[idx] = bgR; data[idx + 1] = bgG; data[idx + 2] = bgB; data[idx + 3] = 255;
            }
          }
        }

        // Reuse cached temp canvas, only resize when needed
        if (!tempCanvasRef.current) {
          tempCanvasRef.current = document.createElement('canvas');
        }
        const tempCanvas = tempCanvasRef.current;
        if (tempCanvas.width !== imgW || tempCanvas.height !== imgH) {
          tempCanvas.width = imgW;
          tempCanvas.height = imgH;
        }
        tempCanvas.getContext('2d')!.putImageData(imgData, 0, 0);

        ctx.imageSmoothingEnabled = false;
        const dx = Math.floor(offsetX + startPxX * zoom);
        const dy = Math.floor(offsetY + startPxY * zoom);
        const dw = Math.ceil(imgW * zoom);
        const dh = Math.ceil(imgH * zoom);
        ctx.drawImage(tempCanvas, dx, dy, dw, dh);
      }

      // Draw canvas border
      ctx.strokeStyle = '#555577';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.floor(offsetX), Math.floor(offsetY),
        Math.ceil(pixelWidth * zoom), Math.ceil(pixelHeight * zoom)
      );

      // Grid lines (only at zoom >= 8 to avoid excessive line count at lower zooms)
      if (showGrid && zoom >= 8) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let px = startPxX; px <= endPxX; px++) {
          const sx = Math.floor(offsetX + px * zoom) + 0.5;
          ctx.moveTo(sx, Math.floor(offsetY + startPxY * zoom));
          ctx.lineTo(sx, Math.floor(offsetY + endPxY * zoom));
        }
        for (let py = startPxY; py <= endPxY; py++) {
          const sy = Math.floor(offsetY + py * zoom) + 0.5;
          ctx.moveTo(Math.floor(offsetX + startPxX * zoom), sy);
          ctx.lineTo(Math.floor(offsetX + endPxX * zoom), sy);
        }
        ctx.stroke();
      }

      // Map borders
      if (showMapBorders) {
        octx.strokeStyle = '#ff6644';
        octx.lineWidth = zoom >= 2 ? 2 : 1;
        octx.setLineDash([]);
        for (let mx = 0; mx <= Math.ceil(pixelWidth / MAP_SIZE); mx++) {
          const sx = Math.floor(offsetX + mx * MAP_SIZE * zoom) + 0.5;
          octx.beginPath();
          octx.moveTo(sx, Math.floor(offsetY));
          octx.lineTo(sx, Math.floor(offsetY + pixelHeight * zoom));
          octx.stroke();
        }
        for (let my = 0; my <= Math.ceil(pixelHeight / MAP_SIZE); my++) {
          const sy = Math.floor(offsetY + my * MAP_SIZE * zoom) + 0.5;
          octx.beginPath();
          octx.moveTo(Math.floor(offsetX), sy);
          octx.lineTo(Math.floor(offsetX + pixelWidth * zoom), sy);
          octx.stroke();
        }
      }

      // Selection overlay
      if (selection) {
        octx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        octx.strokeStyle = '#4a9eff';
        octx.lineWidth = 1;
        octx.setLineDash([4, 4]);

        const sx = Math.floor(offsetX + selection.x * zoom);
        const sy = Math.floor(offsetY + selection.y * zoom);
        const sw = Math.ceil(selection.width * zoom);
        const sh = Math.ceil(selection.height * zoom);

        octx.fillRect(sx, sy, sw, sh);
        octx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);
        octx.setLineDash([]);
      }
    };

    rafId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId.current);
  }, [project, zoom, panX, panY, showGrid, showMapBorders, selection, coloursData, canvasBackground, customBackgroundColour]);

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

  // Draw line between two points (for drag drawing)
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

    if (e.button !== 0) return;

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
  }, [screenToPixel, activeTool, drawBrush, project, selectedColourSetId, selectedTone, onFill, onEyedrop, onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x: px, y: py } = screenToPixel(e.clientX, e.clientY);
    onCursorChange(px, py);

    // Note: cursor highlight drawing is not implemented in the render loop,
    // so we don't trigger a full redraw on every mouse move.

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
  }, [screenToPixel, panX, panY, activeTool, project, drawLine, onCursorChange, onPanChange, onSelectionChange]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (isDrawing.current) {
      isDrawing.current = false;
      lastDrawPos.current = null;
      onCommitPixels(activeTool === 'eraser' ? 'Erase' : 'Draw');
    }

    if (isSelecting.current) {
      isSelecting.current = false;
      selectionStart.current = null;
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

  // Keyboard handling for space (pan mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeld.current = true;
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
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
    : activeTool === 'eyedropper' ? 'crosshair'
    : activeTool === 'fill' ? 'crosshair'
    : 'crosshair';

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isPanning.current = false; isDrawing.current = false; }}
      onWheel={handleWheel}
      onContextMenu={e => e.preventDefault()}
    >
      <canvas ref={canvasRef} />
      <canvas ref={overlayRef} style={{ pointerEvents: 'none' }} />
    </div>
  );
};
