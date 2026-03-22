// New Project dialog — create blank canvas without importing an image

import React, { useState } from 'react';

interface NewProjectDialogProps {
  onConfirm: (mapWidth: number, mapHeight: number) => void;
  onClose: () => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  onConfirm, onClose,
}) => {
  const [widthText, setWidthText] = useState('1');
  const [heightText, setHeightText] = useState('1');

  const parseVal = (text: string, fallback: number) => {
    const v = parseInt(text);
    if (!v || isNaN(v)) return fallback;
    return Math.max(1, Math.min(50, v));
  };

  const mapWidth = parseVal(widthText, 1);
  const mapHeight = parseVal(heightText, 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">New Project</div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Width (maps)</label>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                value={widthText}
                onChange={e => setWidthText(e.target.value)}
                onBlur={() => setWidthText(String(mapWidth))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Height (maps)</label>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                value={heightText}
                onChange={e => setHeightText(e.target.value)}
                onBlur={() => setHeightText(String(mapHeight))}
              />
            </div>
          </div>

          <div className="dimension-display" style={{ marginTop: 8 }}>
            Canvas: {mapWidth * 128} x {mapHeight * 128} pixels
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(mapWidth, mapHeight)}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
