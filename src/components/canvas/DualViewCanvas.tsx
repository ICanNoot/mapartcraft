// Read-only canvas for the dual view right pane — renders dualViewPixels with linked zoom/pan

import React, { useRef, useEffect } from 'react';
import { ProjectState, EMPTY_PIXEL, MAP_SIZE, ToneVariant } from '../../types';

interface DualViewCanvasProps {
  project: ProjectState;
  dualViewPixels: Uint16Array;
  coloursData: Record<string, any>;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showMapBorders: boolean;
}

export const DualViewCanvas: React.FC<DualViewCanvasProps> = ({
  project, dualViewPixels, coloursData, zoom, panX, panY,
  showGrid, showMapBorders,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colourLookup = useRef<Map<number, [number, number, number]>>(new Map());
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!coloursData) return;
    const lookup = new Map<number, [number, number, number]>();
    for (const [key, cs] of Object.entries(coloursData)) {
      const csId = parseInt(key);
      const tones = ['dark', 'normal', 'light', 'unobtainable'] as const;
      for (let ti = 0; ti < tones.length; ti++) {
        const rgb = (cs as any).tonesRGB[tones[ti]];
        if (rgb) lookup.set(csId * 4 + ti, rgb);
      }
    }
    colourLookup.current = lookup;
  }, [coloursData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let rafId = 0;

    const render = () => {
      rafId = requestAnimationFrame(render);

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      ctx.fillStyle = '#1a1917';
      ctx.fillRect(0, 0, cw, ch);

      const { pixelWidth, pixelHeight } = project;
      const lookup = colourLookup.current;
      const offsetX = cw / 2 + panX;
      const offsetY = ch / 2 + panY;
      const startPxX = Math.max(0, Math.floor(-offsetX / zoom));
      const startPxY = Math.max(0, Math.floor(-offsetY / zoom));
      const endPxX = Math.min(pixelWidth, Math.ceil((cw - offsetX) / zoom));
      const endPxY = Math.min(pixelHeight, Math.ceil((ch - offsetY) / zoom));
      const imgW = endPxX - startPxX;
      const imgH = endPxY - startPxY;

      if (imgW > 0 && imgH > 0) {
        const imgData = ctx.createImageData(imgW, imgH);
        const data = imgData.data;

        for (let py = 0; py < imgH; py++) {
          for (let px = 0; px < imgW; px++) {
            const idx = (py * imgW + px) * 4;
            const worldX = startPxX + px;
            const worldY = startPxY + py;
            const encoded = dualViewPixels[worldY * pixelWidth + worldX];
            if (encoded === EMPTY_PIXEL) {
              // Checkerboard
              const cx = Math.floor(worldX / 8);
              const cy = Math.floor(worldY / 8);
              const light = (cx + cy) % 2 === 0;
              data[idx] = light ? 204 : 153;
              data[idx + 1] = light ? 204 : 153;
              data[idx + 2] = light ? 204 : 153;
              data[idx + 3] = 255;
            } else {
              const rgb = lookup.get(encoded);
              if (rgb) {
                data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
              } else {
                data[idx] = 26; data[idx + 1] = 25; data[idx + 2] = 23; data[idx + 3] = 255;
              }
            }
          }
        }

        if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
        const tempCanvas = tempCanvasRef.current;
        if (tempCanvas.width !== imgW || tempCanvas.height !== imgH) {
          tempCanvas.width = imgW; tempCanvas.height = imgH;
        }
        const tempCtx = tempCanvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        tempCtx.putImageData(imgData, 0, 0);

        const dx = Math.floor(offsetX + startPxX * zoom);
        const dy = Math.floor(offsetY + startPxY * zoom);
        const dw = Math.ceil(imgW * zoom);
        const dh = Math.ceil(imgH * zoom);
        ctx.drawImage(tempCanvas, dx, dy, dw, dh);
      }

      // Border
      ctx.strokeStyle = '#454240';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.floor(offsetX), Math.floor(offsetY),
        Math.ceil(pixelWidth * zoom), Math.ceil(pixelHeight * zoom)
      );

      // Grid
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
        ctx.strokeStyle = '#c47a4a';
        ctx.lineWidth = zoom >= 2 ? 2 : 1;
        for (let mx = 0; mx <= Math.ceil(pixelWidth / MAP_SIZE); mx++) {
          const sx = Math.floor(offsetX + mx * MAP_SIZE * zoom) + 0.5;
          ctx.beginPath();
          ctx.moveTo(sx, Math.floor(offsetY));
          ctx.lineTo(sx, Math.floor(offsetY + pixelHeight * zoom));
          ctx.stroke();
        }
        for (let my = 0; my <= Math.ceil(pixelHeight / MAP_SIZE); my++) {
          const sy = Math.floor(offsetY + my * MAP_SIZE * zoom) + 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.floor(offsetX), sy);
          ctx.lineTo(Math.floor(offsetX + pixelWidth * zoom), sy);
          ctx.stroke();
        }
      }
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [project, dualViewPixels, zoom, panX, panY, showGrid, showMapBorders, coloursData]);

  return (
    <div ref={containerRef} className="dual-view-canvas">
      <canvas ref={canvasRef} />
      <div className="dual-view-label">Comparison</div>
    </div>
  );
};
