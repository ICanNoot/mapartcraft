// Preferences modal — app-level settings persisted to localStorage

import React, { useState } from 'react';
import { AppPreferences, ExportFormat, SupportBlockMode } from '../../types';

interface PreferencesDialogProps {
  preferences: AppPreferences;
  onUpdate: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
  onClose: () => void;
}

const SECTIONS = ['Display', 'Behaviour', 'Export'] as const;

export const PreferencesDialog: React.FC<PreferencesDialogProps> = ({
  preferences, onUpdate, onClose,
}) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(SECTIONS));

  const toggleSection = (s: string) => {
    const next = new Set(openSections);
    if (next.has(s)) next.delete(s); else next.add(s);
    setOpenSections(next);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 440 }}>
        <div className="modal-title">Preferences</div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Display */}
          <div className="prefs-section">
            <div className="prefs-section-header" onClick={() => toggleSection('Display')}>
              <span className={`drawer-arrow ${openSections.has('Display') ? 'open' : ''}`}>{'\u25B8'}</span>
              Display
            </div>
            {openSections.has('Display') && (
              <div className="prefs-section-body">
                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.showMinimap}
                    onChange={e => onUpdate('showMinimap', e.target.checked)} />
                  Show minimap / navigator
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.showFloatingColourBox}
                    onChange={e => onUpdate('showFloatingColourBox', e.target.checked)} />
                  Show floating colour box
                </label>
              </div>
            )}
          </div>

          {/* Behaviour */}
          <div className="prefs-section">
            <div className="prefs-section-header" onClick={() => toggleSection('Behaviour')}>
              <span className={`drawer-arrow ${openSections.has('Behaviour') ? 'open' : ''}`}>{'\u25B8'}</span>
              Behaviour
            </div>
            {openSections.has('Behaviour') && (
              <div className="prefs-section-body">
                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.rightClickPopupPalette}
                    onChange={e => onUpdate('rightClickPopupPalette', e.target.checked)} />
                  Right-click popup palette
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.autoExpandPaletteWhenDrawing}
                    onChange={e => onUpdate('autoExpandPaletteWhenDrawing', e.target.checked)} />
                  Auto-expand palette when drawing
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.splitViewMode}
                    onChange={e => onUpdate('splitViewMode', e.target.checked)} />
                  Split view (before/after comparison)
                </label>
                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.showDifferenceOverlay}
                    onChange={e => onUpdate('showDifferenceOverlay', e.target.checked)} />
                  Show difference overlay
                </label>

                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">Before/after hold key</label>
                  <select className="form-select" value={preferences.beforeAfterHoldKey}
                    onChange={e => onUpdate('beforeAfterHoldKey', e.target.value)}>
                    <option value="Tab">Tab</option>
                    <option value="Backslash">Backslash (\)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Recent colours count</label>
                  <input className="form-input" type="number" min={1} max={20}
                    value={preferences.recentColoursCount}
                    onChange={e => onUpdate('recentColoursCount', Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))} />
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="prefs-section">
            <div className="prefs-section-header" onClick={() => toggleSection('Export')}>
              <span className={`drawer-arrow ${openSections.has('Export') ? 'open' : ''}`}>{'\u25B8'}</span>
              Export
            </div>
            {openSections.has('Export') && (
              <div className="prefs-section-body">
                <div className="form-group">
                  <label className="form-label">Default export format</label>
                  <select className="form-select" value={preferences.defaultExportFormat}
                    onChange={e => onUpdate('defaultExportFormat', e.target.value as ExportFormat)}>
                    <option value="schematic">Schematic (NBT)</option>
                    <option value="mapdat">Map Data (map.dat)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Default support block mode</label>
                  <select className="form-select" value={preferences.defaultSupportBlockMode}
                    onChange={e => onUpdate('defaultSupportBlockMode', e.target.value as SupportBlockMode)}>
                    <option value="none">None</option>
                    <option value="important_only">Important Only</option>
                    <option value="all_optimized">All (optimized)</option>
                    <option value="all_double_optimized">All (double)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Default support block type</label>
                  <select className="form-select" value={preferences.defaultSupportBlockType}
                    onChange={e => onUpdate('defaultSupportBlockType', e.target.value)}>
                    <option value="stone">Stone</option>
                    <option value="dirt">Dirt</option>
                    <option value="netherrack">Netherrack</option>
                    <option value="cobblestone">Cobblestone</option>
                    <option value="sandstone">Sandstone</option>
                  </select>
                </div>

                <label className="form-checkbox">
                  <input type="checkbox" checked={preferences.rememberLastExportSettings}
                    onChange={e => onUpdate('rememberLastExportSettings', e.target.checked)} />
                  Remember last export settings
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
