// Floating colour preview box — anchored bottom-left of canvas

import React from 'react';
import { ToneVariant } from '../../types';

interface FloatingColourBoxProps {
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  coloursData: Record<string, any> | null;
  blockChoices: Record<number, number>;
}

export const FloatingColourBox: React.FC<FloatingColourBoxProps> = ({
  selectedColourSetId, selectedTone, coloursData, blockChoices,
}) => {
  const cs = coloursData?.[selectedColourSetId.toString()];
  const rgb = cs?.tonesRGB?.[selectedTone] as [number, number, number] | undefined;
  const colourName = cs?.colourName || 'None';

  let blockName = 'None';
  if (cs?.blocks) {
    const chosenIdx = blockChoices[selectedColourSetId] ?? 0;
    const block = cs.blocks[chosenIdx.toString()] || Object.values(cs.blocks)[0];
    if (block) blockName = (block as any).displayName;
  }

  return (
    <div className="floating-colour-box">
      <div
        className="fcb-swatch"
        style={{
          backgroundColor: rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : '#2d2b28',
        }}
      />
      <div className="fcb-info">
        <div className="fcb-block-name">{blockName}</div>
        <div className="fcb-colour-name">{colourName}</div>
        <div className="fcb-data">
          {rgb ? `${rgb[0]}, ${rgb[1]}, ${rgb[2]}` : 'N/A'}
          {' \u00B7 '}
          {selectedTone}
        </div>
      </div>
    </div>
  );
};
