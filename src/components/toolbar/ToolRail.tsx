// Narrow left tool rail — vertical tool rack with workshop aesthetic

import React from 'react';
import { ToolType, ToneVariant } from '../../types';

interface ToolRailProps {
  activeTool: ToolType;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  coloursData: Record<string, any> | null;
  onToolChange: (tool: ToolType) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onColourSwatchClick: () => void;
}

const TOOLS: { id: ToolType; icon: string; label: string; shortcut: string }[] = [
  { id: 'pencil', icon: '\u270F', label: 'Pencil', shortcut: 'B' },
  { id: 'eraser', icon: '\u2337', label: 'Eraser', shortcut: 'E' },
  { id: 'eyedropper', icon: '\u2316', label: 'Picker', shortcut: 'I' },
  { id: 'fill', icon: '\u25A7', label: 'Fill', shortcut: 'G' },
  { id: 'selection', icon: '\u25A1', label: 'Select', shortcut: 'M' },
];

const BRUSH_SIZES = [1, 3, 5];

export const ToolRail: React.FC<ToolRailProps> = ({
  activeTool, brushSize, canUndo, canRedo,
  selectedColourSetId, selectedTone, coloursData,
  onToolChange, onBrushSizeChange, onUndo, onRedo,
  onColourSwatchClick,
}) => {
  // Get RGB for active colour swatch
  const cs = coloursData?.[selectedColourSetId.toString()];
  const rgb = cs?.tonesRGB?.[selectedTone] as [number, number, number] | undefined;

  return (
    <div className="tool-rail">
      {/* Undo/Redo — side by side */}
      <div className="rail-section rail-undo-redo">
        <button
          className="rail-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <span className="rail-icon">{'\u21B6'}</span>
        </button>
        <button
          className="rail-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <span className="rail-icon">{'\u21B7'}</span>
        </button>
      </div>

      <div className="rail-divider" />

      {/* Tools */}
      <div className="rail-section">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`rail-btn rail-tool ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span className="rail-icon">{tool.icon}</span>
            <span className="rail-label">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="rail-divider" />

      {/* Brush Size */}
      {(activeTool === 'pencil' || activeTool === 'eraser') && (
        <>
          <div className="rail-section">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                className={`rail-btn rail-brush ${brushSize === size ? 'active' : ''}`}
                onClick={() => onBrushSizeChange(size)}
                title={`Brush ${size}px`}
              >
                <span className="rail-brush-dot" style={{
                  width: Math.min(size * 4, 16),
                  height: Math.min(size * 4, 16),
                }} />
                <span className="rail-label">{size}px</span>
              </button>
            ))}
          </div>
          <div className="rail-divider" />
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Active Colour Swatch */}
      <div className="rail-section">
        <button
          className="rail-colour-swatch"
          onClick={onColourSwatchClick}
          title="Active colour — click to open palette"
          style={{
            backgroundColor: rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : '#2d2b28',
          }}
        />
      </div>
    </div>
  );
};
