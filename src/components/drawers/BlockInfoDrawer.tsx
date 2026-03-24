// Block Info drawer — shows detail about hovered or selected pixel

import React from 'react';
import { ProjectState, MAP_SIZE, decodePixel } from '../../types';

interface BlockInfoDrawerProps {
  project: ProjectState | null;
  coloursData: Record<string, any> | null;
  cursorX: number;
  cursorY: number;
  selectedColourSetId: number;
  selectedTone: string;
  blockChoices: Record<number, number>;
}

export const BlockInfoDrawer: React.FC<BlockInfoDrawerProps> = ({
  project, coloursData, cursorX, cursorY,
  selectedColourSetId, selectedTone, blockChoices,
}) => {
  const inBounds = project && cursorX >= 0 && cursorX < project.pixelWidth
    && cursorY >= 0 && cursorY < project.pixelHeight;

  let blockName = '';
  let colourName = '';
  let tone = '';
  let rgb: [number, number, number] | null = null;
  let posInfo = '';

  if (inBounds && coloursData && project) {
    const idx = cursorY * project.pixelWidth + cursorX;
    const encoded = project.pixels[idx];
    const decoded = decodePixel(encoded);
    if (decoded) {
      const cs = coloursData[decoded.colourSetId.toString()];
      if (cs) {
        colourName = cs.colourName || 'Unknown';
        const chosenBlockIdx = blockChoices[decoded.colourSetId] ?? 0;
        const blocks = Object.values(cs.blocks) as any[];
        const block = blocks[chosenBlockIdx] || blocks[0];
        blockName = block?.displayName || 'Unknown';
        tone = decoded.tone;
        if (cs.tonesRGB?.[decoded.tone]) {
          rgb = cs.tonesRGB[decoded.tone];
        }
        const mapX = Math.floor(cursorX / MAP_SIZE);
        const mapY = Math.floor(cursorY / MAP_SIZE);
        posInfo = `Pixel ${cursorX}, ${cursorY} \u00B7 Map ${mapX},${mapY}`;
      }
    }
  }

  // Fallback to selected colour when not hovering
  if (!blockName && coloursData) {
    const cs = coloursData[selectedColourSetId.toString()];
    if (cs) {
      colourName = cs.colourName || 'Unknown';
      const chosenBlockIdx = blockChoices[selectedColourSetId] ?? 0;
      const block = cs.blocks?.[chosenBlockIdx.toString()] || Object.values(cs.blocks || {})[0];
      blockName = (block as any)?.displayName || 'Unknown';
      tone = selectedTone;
      if (cs.tonesRGB?.[selectedTone]) {
        rgb = cs.tonesRGB[selectedTone];
      }
      posInfo = 'Selected colour';
    }
  }

  if (!blockName) {
    return <div className="block-info-empty">Hover over canvas to see block info</div>;
  }

  return (
    <div className="block-info-content">
      <div className="block-info-row">
        {rgb && (
          <div
            className="block-info-swatch"
            style={{ backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
          />
        )}
        <div className="block-info-details">
          <div className="block-info-name">{blockName}</div>
          <div className="block-info-colour">{colourName} \u00B7 {tone}</div>
          {rgb && <div className="block-info-rgb">RGB({rgb[0]}, {rgb[1]}, {rgb[2]})</div>}
        </div>
      </div>
      {posInfo && <div className="block-info-pos">{posInfo}</div>}
    </div>
  );
};
