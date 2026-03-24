// Minimap navigator — thumbnail of full map with viewport overlay and drag-to-pan

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ProjectState, EMPTY_PIXEL, ToneVariant } from '../../types';

interface MinimapProps {
  project: ProjectState;
  coloursData: Record<string, any>;
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  onPanChange: (x: number, y: number) => void;
}

const MAX_W = 160;
const MAX_H = 120;

export const Minimap: React.FC<MinimapProps> = ({
  project, coloursData, zoom, panX, panY,
  canvasWidth, canvasHeight,
  selectedColourSetId, selectedTone,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [needsRender, setNeedsRender] = useState(0);

  // Compute display dimensions
  const aspect = project.pixelWidth / project.pixelHeight;
  const displayW = aspect >= MAX_W / MAX_H ? MAX_W : Math.round(MAX_H * aspect);
  const displayH = aspect >= MAX_W / MAX_H ? Math.round(MAX_W / aspect) : MAX_H;
  const scaleX = displayW / project.pixelWidth;
  const scaleY = displayH / project.pixelHeight;

  // Debounced render on pixel changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNeedsRender(n => n + 1), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [project.pixels]);

  // Render thumbnail
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = displayW;
    canvas.height = displayH;

    const imgData = ctx.createImageData(displayW, displayH);
    const data = imgData.data;
    const stepX = project.pixelWidth / displayW;
    const stepY = project.pixelHeight / displayH;

    for (let ty = 0; ty < displayH; ty++) {
      for (let tx = 0; tx < displayW; tx++) {
        const px = Math.floor(tx * stepX);
        const py = Math.floor(ty * stepY);
        const encoded = project.pixels[py * project.pixelWidth + px];
        const idx = (ty * displayW + tx) * 4;

        if (encoded === EMPTY_PIXEL) {
          data[idx] = 30; data[idx + 1] = 29; data[idx + 2] = 27; data[idx + 3] = 255;
          continue;
        }

        const csId = Math.floor(encoded / 4);
        const toneIdx = encoded % 4;
        const tones: ToneVariant[] = ['dark', 'normal', 'light', 'unobtainable'];
        const cs = coloursData[csId.toString()];
        const rgb = cs?.tonesRGB?.[tones[toneIdx]];
        if (rgb) {
          data[idx] = rgb[0]; data[idx + 1] = rgb[1]; data[idx + 2] = rgb[2]; data[idx + 3] = 255;
        } else {
          data[idx] = 30; data[idx + 1] = 29; data[idx + 2] = 27; data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw viewport rectangle
    const vpLeft = (-panX - canvasWidth / 2) / zoom;
    const vpTop = (-panY - canvasHeight / 2) / zoom;
    const vpW = canvasWidth / zoom;
    const vpH = canvasHeight / zoom;

    const rx = vpLeft * scaleX;
    const ry = vpTop * scaleY;
    const rw = vpW * scaleX;
    const rh = vpH * scaleY;

    ctx.strokeStyle = 'rgba(232, 220, 200, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(232, 220, 200, 0.1)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
  }, [needsRender, project, coloursData, zoom, panX, panY, canvasWidth, canvasHeight, displayW, displayH, scaleX, scaleY]);

  // Convert minimap click to pan
  const minimapToPan = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // World coordinate user clicked
    const worldX = mx / scaleX;
    const worldY = my / scaleY;

    // Pan so this world coord is centred
    const newPanX = -(worldX * zoom);
    const newPanY = -(worldY * zoom);
    onPanChange(newPanX, newPanY);
  }, [scaleX, scaleY, zoom, onPanChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    minimapToPan(e.clientX, e.clientY);
  }, [minimapToPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    minimapToPan(e.clientX, e.clientY);
  }, [minimapToPan]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    const handleGlobalUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleGlobalUp);
    return () => window.removeEventListener('mouseup', handleGlobalUp);
  }, []);

  // Active colour swatch
  const cs = coloursData?.[selectedColourSetId.toString()];
  const rgb = cs?.tonesRGB?.[selectedTone] as [number, number, number] | undefined;

  return (
    <div className="minimap-panel" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        style={{ width: displayW, height: displayH }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      <div
        className="minimap-colour-swatch"
        style={{
          backgroundColor: rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : '#2d2b28',
        }}
      />
    </div>
  );
};
