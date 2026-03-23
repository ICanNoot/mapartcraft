// Export dialog — supports NBT schematic and map.dat formats

import React, { useState } from 'react';
import {
  ExportSettings, SupportBlockMode, ProjectState, ExportFormat, MAP_SIZE,
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
    exportFormat: 'schematic',
    startingMapId: 0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  });

  const update = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const isMapDat = settings.exportFormat === 'mapdat';

  const fileList: string[] = [];
  if (isMapDat) {
    for (let my = 0; my < project.mapHeight; my++) {
      for (let mx = 0; mx < project.mapWidth; mx++) {
        const mapId = settings.startingMapId + my * project.mapWidth + mx;
        fileList.push(`map_${mapId}.dat`);
      }
    }
  } else if (settings.splitExport) {
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
        <div className="modal-title">Export</div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Export Format</label>
            <select
              className="form-select"
              value={settings.exportFormat}
              onChange={e => update('exportFormat', e.target.value as ExportFormat)}
            >
              <option value="schematic">Schematic (NBT) — for Litematica</option>
              <option value="mapdat">Map Data (map.dat) — drop into world</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Filename</label>
            <input
              className="form-input"
              type="text"
              value={settings.filename}
              onChange={e => update('filename', e.target.value)}
            />
          </div>

          {isMapDat ? (
            <div className="form-group">
              <label className="form-label">Starting Map ID</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={settings.startingMapId}
                onChange={e => update('startingMapId', Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
          ) : (
            <>
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
                <label className="form-label">Position Offset</label>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 10 }}>X</label>
                    <input
                      className="form-input"
                      type="number"
                      value={settings.offsetX}
                      onChange={e => update('offsetX', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 10 }}>Y</label>
                    <input
                      className="form-input"
                      type="number"
                      value={settings.offsetY}
                      onChange={e => update('offsetY', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 10 }}>Z</label>
                    <input
                      className="form-input"
                      type="number"
                      value={settings.offsetZ}
                      onChange={e => update('offsetZ', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">
              Files to export ({fileList.length} file{fileList.length > 1 ? 's' : ''})
              {fileList.length > 1 && ' — bundled as ZIP'}
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
