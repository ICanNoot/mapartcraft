// Left sidebar — tool selection panel

import React from 'react';
import { ToolType, ToneVariant, decodePixel } from '../../types';

interface ToolPanelProps {
  activeTool: ToolType;
  brushSize: number;
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  coloursData: Record<string, any> | null;
  onToolChange: (tool: ToolType) => void;
  onBrushSizeChange: (size: number) => void;
}

const TOOLS: { id: ToolType; icon: string; label: string; shortcut: string }[] = [
  { id: 'pencil', icon: '\u270F', label: 'Pencil', shortcut: 'B' },
  { id: 'eraser', icon: '\u2337', label: 'Eraser', shortcut: 'E' },
  { id: 'eyedropper', icon: '\u2316', label: 'Picker', shortcut: 'I' },
  { id: 'fill', icon: '\u25A7', label: 'Fill', shortcut: 'G' },
  { id: 'selection', icon: '\u25A1', label: 'Select', shortcut: 'M' },
];

const BRUSH_SIZES = [1, 3, 5];

export const ToolPanel: React.FC<ToolPanelProps> = ({
  activeTool, brushSize, selectedColourSetId, selectedTone,
  coloursData, onToolChange, onBrushSizeChange,
}) => {
  // Get colour info for preview
  const cs = coloursData?.[selectedColourSetId.toString()];
  const rgb = cs?.tonesRGB?.[selectedTone] as [number, number, number] | undefined;
  const colourName = cs?.colourName || 'None';

  // Get block name
  let blockName = 'None';
  if (cs?.blocks) {
    const firstBlock = Object.values(cs.blocks)[0] as any;
    if (firstBlock) blockName = firstBlock.displayName;
  }

  return (
    <div className="left-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Tools</div>
        <div className="tool-grid">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => onToolChange(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <span className="tool-icon">{tool.icon}</span>
              <span>{tool.label}</span>
              <span className="tool-shortcut">{tool.shortcut}</span>
            </button>
          ))}
        </div>
      </div>

      {(activeTool === 'pencil' || activeTool === 'eraser') && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Brush Size</div>
          <div className="brush-sizes">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                className={`brush-size-btn ${brushSize === size ? 'active' : ''}`}
                onClick={() => onBrushSizeChange(size)}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-title">Current Colour</div>
        <div className="colour-preview">
          <div
            className="colour-swatch-large"
            style={{
              backgroundColor: rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : '#2d2b28',
            }}
          />
          <div className="colour-info">
            <div className="block-name">{blockName}</div>
            <div>{colourName}</div>
            <div className="rgb-value">
              {rgb ? `RGB(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : 'N/A'}
            </div>
            <div className="rgb-value">
              Tone: {selectedTone}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
