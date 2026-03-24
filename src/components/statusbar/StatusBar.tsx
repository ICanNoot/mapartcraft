// Bottom status bar with cursor position, zoom, canvas info, and hovered block info

import React from 'react';
import { ProjectState, MAP_SIZE, decodePixel } from '../../types';

interface StatusBarProps {
  project: ProjectState | null;
  coloursData: Record<string, any> | null;
  cursorX: number;
  cursorY: number;
  zoom: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  project, coloursData, cursorX, cursorY, zoom,
}) => {
  const mapX = cursorX >= 0 ? Math.floor(cursorX / MAP_SIZE) : -1;
  const mapY = cursorY >= 0 ? Math.floor(cursorY / MAP_SIZE) : -1;
  const localX = cursorX >= 0 ? cursorX % MAP_SIZE : -1;
  const localY = cursorY >= 0 ? cursorY % MAP_SIZE : -1;

  const inBounds = project && cursorX >= 0 && cursorX < project.pixelWidth && cursorY >= 0 && cursorY < project.pixelHeight;

  // Look up hovered block info
  let blockInfo: string | null = null;
  let blockMeta: string | null = null;
  if (inBounds && coloursData && project) {
    const idx = cursorY * project.pixelWidth + cursorX;
    const encoded = project.pixels[idx];
    const decoded = decodePixel(encoded);
    if (decoded) {
      const cs = coloursData[decoded.colourSetId.toString()];
      if (cs) {
        const colourName = cs.colourName || 'Unknown';
        // Get block name from blockChoices or first block
        const chosenBlockIdx = project.blockChoices[decoded.colourSetId];
        const blocks = Object.values(cs.blocks) as any[];
        const block = (chosenBlockIdx !== undefined && blocks[chosenBlockIdx]) || blocks[0];
        const blockName = block?.displayName || 'Unknown';
        // Get RGB from colour tones
        const toneMultipliers: Record<string, number[]> = {
          dark: [180, 180, 180],
          normal: [220, 220, 220],
          light: [255, 255, 255],
        };
        let r = cs.baseColour?.[0] ?? 0;
        let g = cs.baseColour?.[1] ?? 0;
        let b = cs.baseColour?.[2] ?? 0;
        // Use actual multiplied colours if available from tonesRGB
        if (cs.tonesRGB && cs.tonesRGB[decoded.tone]) {
          [r, g, b] = cs.tonesRGB[decoded.tone];
        } else {
          // Apply tone multiplier
          const mult = toneMultipliers[decoded.tone] || [220, 220, 220];
          r = Math.round((r * mult[0]) / 255);
          g = Math.round((g * mult[1]) / 255);
          b = Math.round((b * mult[2]) / 255);
        }
        blockInfo = blockName;
        blockMeta = `(${colourName}) — ${decoded.tone} — RGB(${r}, ${g}, ${b})`;
      }
    }
  }

  return (
    <div className="status-bar">
      {inBounds ? (
        <>
          <div className="status-item">
            <span className="status-label">Pixel:</span>
            <span className="status-value">{cursorX}, {cursorY}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Map:</span>
            <span className="status-value">{mapX},{mapY} [{localX},{localY}]</span>
          </div>
          {blockInfo && (
            <div className="status-item">
              <span className="status-block-name">{blockInfo}</span>
              <span className="status-value">{blockMeta}</span>
            </div>
          )}
        </>
      ) : (
        <div className="status-item">
          <span className="status-label">Cursor outside canvas</span>
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div className="status-item">
        <span className="status-label">Zoom:</span>
        <span className="status-value">{(zoom * 100).toFixed(0)}%</span>
      </div>
      {project && (
        <>
          <div className="status-item">
            <span className="status-label">Canvas:</span>
            <span className="status-value">
              {project.mapWidth}x{project.mapHeight} maps ({project.pixelWidth}x{project.pixelHeight}px)
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Mode:</span>
            <span className="status-value">{project.conversionSettings.mapMode}</span>
          </div>
        </>
      )}
    </div>
  );
};
