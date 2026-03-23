// New Project dialog — create blank canvas without importing an image

import React, { useState } from 'react';

const NumSpinner: React.FC<{
  onUp: () => void;
  onDown: () => void;
}> = ({ onUp, onDown }) => (
  <div className="num-spinner">
    <button type="button" tabIndex={-1} onClick={onUp}>&#9650;</button>
    <button type="button" tabIndex={-1} onClick={onDown}>&#9660;</button>
  </div>
);

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
              <div className="input-with-spinner">
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  value={widthText}
                  onChange={e => setWidthText(e.target.value)}
                  onBlur={() => setWidthText(String(mapWidth))}
                />
                <NumSpinner
                  onUp={() => { const v = Math.min(50, mapWidth + 1); setWidthText(String(v)); }}
                  onDown={() => { const v = Math.max(1, mapWidth - 1); setWidthText(String(v)); }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Height (maps)</label>
              <div className="input-with-spinner">
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  value={heightText}
                  onChange={e => setHeightText(e.target.value)}
                  onBlur={() => setHeightText(String(mapHeight))}
                />
                <NumSpinner
                  onUp={() => { const v = Math.min(50, mapHeight + 1); setHeightText(String(v)); }}
                  onDown={() => { const v = Math.max(1, mapHeight - 1); setHeightText(String(v)); }}
                />
              </div>
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
