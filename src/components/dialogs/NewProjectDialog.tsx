// New Project dialog — create blank canvas without importing an image

import React, { useState } from 'react';

interface NewProjectDialogProps {
  onConfirm: (mapWidth: number, mapHeight: number) => void;
  onClose: () => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  onConfirm, onClose,
}) => {
  const [mapWidth, setMapWidth] = useState(1);
  const [mapHeight, setMapHeight] = useState(1);

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
                type="number"
                min={1}
                max={10}
                value={mapWidth}
                onChange={e => setMapWidth(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Height (maps)</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={10}
                value={mapHeight}
                onChange={e => setMapHeight(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
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
