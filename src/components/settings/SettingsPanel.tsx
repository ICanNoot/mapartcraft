// Conversion settings panel — adjustable at any time, triggers live re-conversion

import React from 'react';
import {
  ConversionSettings, MapMode, StaircaseMode, DitherMethod,
} from '../../types';
import supportedVersions from '../../data/supportedVersions.json';

interface SettingsPanelProps {
  settings: ConversionSettings;
  hasSourceImage: boolean;
  mapWidth: number;
  mapHeight: number;
  onSettingChange: <K extends keyof ConversionSettings>(key: K, value: ConversionSettings[K], debounce?: boolean) => void;
  onMapSizeChange: (mapWidth: number, mapHeight: number) => void;
}

const versionEntries = Object.values(supportedVersions as Record<string, { MCVersion: string; NBTVersion: number }>)
  .sort((a, b) => {
    const pa = a.MCVersion.split('.').map(Number);
    const pb = b.MCVersion.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
    }
    return 0;
  });

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings, hasSourceImage, mapWidth, mapHeight,
  onSettingChange, onMapSizeChange,
}) => {
  return (
    <div className="settings-panel">
      {!hasSourceImage && (
        <div className="settings-notice">
          Import an image to enable live conversion settings.
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">Map Size</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Width</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={10}
              value={mapWidth}
              disabled={!hasSourceImage}
              onChange={e => {
                const v = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                onMapSizeChange(v, mapHeight);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Height</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={10}
              value={mapHeight}
              disabled={!hasSourceImage}
              onChange={e => {
                const v = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                onMapSizeChange(mapWidth, v);
              }}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Map Mode</div>
        <div className="form-group" style={{ marginBottom: 8 }}>
          <select
            className="form-select"
            value={settings.mapMode}
            onChange={e => onSettingChange('mapMode', e.target.value as MapMode)}
          >
            <option value="flat">Flat</option>
            <option value="staircase">Staircase</option>
          </select>
        </div>

        {settings.mapMode === 'staircase' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Staircase Mode</label>
            <select
              className="form-select"
              value={settings.staircaseMode}
              onChange={e => onSettingChange('staircaseMode', e.target.value as StaircaseMode)}
            >
              <option value="classic">Classic</option>
              <option value="valley">Valley</option>
              <option value="full_dark">Full Dark</option>
              <option value="full_light">Full Light</option>
            </select>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Colour Conversion</div>

        <div className="form-group">
          <label className="form-label">Dithering</label>
          <select
            className="form-select"
            value={settings.ditherMethod}
            onChange={e => onSettingChange('ditherMethod', e.target.value as DitherMethod)}
          >
            <option value="none">None</option>
            <option value="floyd_steinberg">Floyd-Steinberg</option>
            <option value="bayer_4x4">Bayer 4x4</option>
            <option value="bayer_2x2">Bayer 2x2</option>
            <option value="ordered_3x3">Ordered 3x3</option>
            <option value="minavgerr">MinAvgErr</option>
            <option value="burkes">Burkes</option>
            <option value="sierra_lite">Sierra-Lite</option>
            <option value="stucki">Stucki</option>
            <option value="atkinson">Atkinson</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={settings.betterColour}
              onChange={e => onSettingChange('betterColour', e.target.checked)}
            />
            Better Colour (CIE Lab)
          </label>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={settings.carpetOnly}
              onChange={e => onSettingChange('carpetOnly', e.target.checked)}
            />
            Carpet Only
          </label>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Preprocessing</div>

        <div className="form-group">
          <label className="form-label">Brightness</label>
          <div className="slider-row">
            <input
              type="range"
              className="form-slider"
              min={-100}
              max={100}
              value={settings.brightness}
              onChange={e => onSettingChange('brightness', parseInt(e.target.value), true)}
            />
            <span className="slider-value">{settings.brightness}</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Contrast</label>
          <div className="slider-row">
            <input
              type="range"
              className="form-slider"
              min={-100}
              max={100}
              value={settings.contrast}
              onChange={e => onSettingChange('contrast', parseInt(e.target.value), true)}
            />
            <span className="slider-value">{settings.contrast}</span>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Saturation</label>
          <div className="slider-row">
            <input
              type="range"
              className="form-slider"
              min={-100}
              max={100}
              value={settings.saturation}
              onChange={e => onSettingChange('saturation', parseInt(e.target.value), true)}
            />
            <span className="slider-value">{settings.saturation}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
