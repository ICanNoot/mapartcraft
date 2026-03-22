// NBT export dialog

import React, { useState } from 'react';
import {
  ExportSettings, SupportBlockMode, ProjectState, MAP_SIZE,
} from '../../types';

interface ExportDialogProps {
  project: ProjectState;
  onExport: (settings: ExportSettings) => void;
  onClose: () => void;
}

const SUPPORT_BLOCKS = [
  { name: 'stone', label: 'Stone' },
  { name: 'dirt', label: 'Dirt' },
  { name: 'netherrack', label: 'Netherrack' },
  { name: 'cobblestone', label: 'Cobblestone' },
  { name: 'sandstone', label: 'Sandstone' },
];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  project, onExport, onClose,
}) => {
  const [settings, setSettings] = useState<ExportSettings>({
    filename: 'mapart',
    splitExport: project.mapWidth > 1 || project.mapHeight > 1,
    supportBlockMode: 'important_only',
    supportBlockType: 'stone',
    version: '1.20',
  });

  const update = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const fileList: string[] = [];
  if (settings.splitExport) {
    for (let my = 0; my < project.mapHeight; my++) {
      for (let mx = 0; mx < project.mapWidth; mx++) {
        fileList.push(`${settings.filename}_${mx}_${my}.nbt`);
      }
    }
  } else {
    fileList.push(`${settings.filename}.nbt`);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Export NBT</div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Filename</label>
            <input
              className="form-input"
              type="text"
              value={settings.filename}
              onChange={e => update('filename', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Export Mode</label>
            <select
              className="form-select"
              value={settings.splitExport ? 'split' : 'single'}
              onChange={e => update('splitExport', e.target.value === 'split')}
            >
              <option value="single">Single File (entire canvas)</option>
              <option value="split">Split 1x1 (one per map)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Support Blocks</label>
            <select
              className="form-select"
              value={settings.supportBlockMode}
              onChange={e => update('supportBlockMode', e.target.value as SupportBlockMode)}
            >
              <option value="none">None</option>
              <option value="important_only">Important Only (carpets)</option>
              <option value="all_optimized">All (optimized)</option>
              <option value="all_double_optimized">All (double optimized)</option>
            </select>
          </div>

          {settings.supportBlockMode !== 'none' && (
            <div className="form-group">
              <label className="form-label">Support Block Type</label>
              <select
                className="form-select"
                value={settings.supportBlockType}
                onChange={e => update('supportBlockType', e.target.value)}
              >
                {SUPPORT_BLOCKS.map(b => (
                  <option key={b.name} value={b.name}>{b.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Files to export ({fileList.length} file{fileList.length > 1 ? 's' : ''})
              {settings.splitExport && fileList.length > 1 && ' — bundled as ZIP'}
            </label>
            <div className="export-file-list">
              {fileList.map(f => <div key={f}>{f}</div>)}
            </div>
          </div>

          <div className="dimension-display" style={{ marginTop: 8 }}>
            Canvas: {project.mapWidth}x{project.mapHeight} maps
            ({project.pixelWidth}x{project.pixelHeight} pixels)
            | Mode: {project.conversionSettings.mapMode}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onExport(settings)}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};
