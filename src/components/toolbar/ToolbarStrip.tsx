// Horizontal toolbar strip — replaces left sidebar

import React from 'react';
import { ToolType } from '../../types';

interface ToolbarStripProps {
  hasProject: boolean;
  activeTool: ToolType;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  showMapBorders: boolean;
  onToolChange: (tool: ToolType) => void;
  onBrushSizeChange: (size: number) => void;
  onOpenImage: () => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  onToggleGrid: () => void;
  onToggleMapBorders: () => void;
}

const TOOLS: { id: ToolType; icon: string; label: string; shortcut: string }[] = [
  { id: 'pencil', icon: '\u270F', label: 'Pencil', shortcut: 'B' },
  { id: 'eraser', icon: '\u2337', label: 'Eraser', shortcut: 'E' },
  { id: 'eyedropper', icon: '\u2316', label: 'Picker', shortcut: 'I' },
  { id: 'fill', icon: '\u25A7', label: 'Fill', shortcut: 'G' },
  { id: 'selection', icon: '\u25A1', label: 'Select', shortcut: 'M' },
];

const BRUSH_SIZES = [1, 3, 5];

export const ToolbarStrip: React.FC<ToolbarStripProps> = ({
  hasProject, activeTool, brushSize, canUndo, canRedo,
  showGrid, showMapBorders,
  onToolChange, onBrushSizeChange,
  onOpenImage, onNewProject, onSaveProject, onExport,
  onUndo, onRedo, onZoomIn, onZoomOut, onFitToWindow,
  onToggleGrid, onToggleMapBorders,
}) => {
  return (
    <div className="toolbar-strip">
      {/* File group */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onOpenImage} title="Open Image (Ctrl+O)">
          <span className="toolbar-icon">{'\u{1F4C2}'}</span>
        </button>
        <button className="toolbar-btn" onClick={onNewProject} title="New Project">
          <span className="toolbar-icon">{'\u{2795}'}</span>
        </button>
        <button
          className="toolbar-btn"
          onClick={onSaveProject}
          title="Save Project (Ctrl+S)"
          disabled={!hasProject}
        >
          <span className="toolbar-icon">{'\u{1F4BE}'}</span>
        </button>
        <button
          className="toolbar-btn"
          onClick={onExport}
          title="Export (Ctrl+E)"
          disabled={!hasProject}
        >
          <span className="toolbar-icon">{'\u{1F4E6}'}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Tools group */}
      <div className="toolbar-group">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`toolbar-btn toolbar-tool ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span className="toolbar-icon">{tool.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Brush size group */}
      {(activeTool === 'pencil' || activeTool === 'eraser') && (
        <>
          <div className="toolbar-group">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                className={`toolbar-btn toolbar-brush ${brushSize === size ? 'active' : ''}`}
                onClick={() => onBrushSizeChange(size)}
                title={`Brush ${size}px`}
              >
                <span className="toolbar-brush-label">{size}</span>
              </button>
            ))}
          </div>
          <div className="toolbar-divider" />
        </>
      )}

      {/* History group */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <span className="toolbar-icon">{'\u21B6'}</span>
        </button>
        <button className="toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <span className="toolbar-icon">{'\u21B7'}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* View group */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onZoomIn} title="Zoom In (+)">
          <span className="toolbar-icon">{'\u{1F50D}'}</span>
        </button>
        <button className="toolbar-btn" onClick={onZoomOut} title="Zoom Out (-)">
          <span className="toolbar-icon">{'\u{1F50E}'}</span>
        </button>
        <button className="toolbar-btn" onClick={onFitToWindow} title="Fit to Window (Ctrl+0)">
          <span className="toolbar-icon">{'\u2922'}</span>
        </button>
        <button
          className={`toolbar-btn ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title="Toggle Grid"
        >
          <span className="toolbar-icon">{'\u2586'}</span>
        </button>
        <button
          className={`toolbar-btn ${showMapBorders ? 'active' : ''}`}
          onClick={onToggleMapBorders}
          title="Toggle Map Borders"
        >
          <span className="toolbar-icon">{'\u25A3'}</span>
        </button>
      </div>
    </div>
  );
};
