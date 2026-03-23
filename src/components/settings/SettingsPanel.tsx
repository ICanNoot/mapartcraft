// Conversion settings panel — adjustable at any time, triggers live re-conversion

import React, { useState, useEffect, useCallback } from 'react';
import {
  ConversionSettings, MapMode, StaircaseMode, DitherMethod, ResizeAlgorithm, CanvasBackground,
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

/**
 * Slider + editable number input combo.
 * Slider drags trigger debounced updates; typed input applies on blur/Enter.
 */
const SliderWithInput: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (value: number, debounce: boolean) => void;
}> = ({ value, min, max, onChange }) => {
  const [text, setText] = useState(String(value));

  useEffect(() => { setText(String(value)); }, [value]);

  const commit = useCallback(() => {
    const v = parseInt(text);
    if (isNaN(v) || text.trim() === '') { setText(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, v));
    setText(String(clamped));
    if (clamped !== value) onChange(clamped, false);
  }, [text, value, min, max, onChange]);

  return (
    <div className="slider-row">
      <input
        type="range"
        className="form-slider"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value), true)}
      />
      <input
        type="text"
        inputMode="numeric"
        className="slider-number-input"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
        }}
      />
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings, hasSourceImage, mapWidth, mapHeight,
  onSettingChange, onMapSizeChange,
}) => {
  const [widthText, setWidthText] = useState(String(mapWidth));
  const [heightText, setHeightText] = useState(String(mapHeight));

  // Sync text fields when external values change (e.g. after reconvert)
  useEffect(() => { setWidthText(String(mapWidth)); }, [mapWidth]);
  useEffect(() => { setHeightText(String(mapHeight)); }, [mapHeight]);

  const commitWidth = () => {
    const v = parseInt(widthText);
    if (!v || isNaN(v)) { setWidthText(String(mapWidth)); return; }
    const clamped = Math.max(1, Math.min(50, v));
    setWidthText(String(clamped));
    if (clamped !== mapWidth) onMapSizeChange(clamped, mapHeight);
  };

  const commitHeight = () => {
    const v = parseInt(heightText);
    if (!v || isNaN(v)) { setHeightText(String(mapHeight)); return; }
    const clamped = Math.max(1, Math.min(50, v));
    setHeightText(String(clamped));
    if (clamped !== mapHeight) onMapSizeChange(mapWidth, clamped);
  };

  const handleKeyDown = (e: React.KeyboardEvent, commit: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
  };

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
              type="text"
              inputMode="numeric"
              value={widthText}
              disabled={!hasSourceImage}
              onChange={e => setWidthText(e.target.value)}
              onBlur={commitWidth}
              onKeyDown={e => handleKeyDown(e, commitWidth)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Height</label>
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              value={heightText}
              disabled={!hasSourceImage}
              onChange={e => setHeightText(e.target.value)}
              onBlur={commitHeight}
              onKeyDown={e => handleKeyDown(e, commitHeight)}
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
        <div className="settings-section-title">Resize</div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Resize Algorithm</label>
          <select
            className="form-select"
            value={settings.resizeAlgorithm}
            onChange={e => onSettingChange('resizeAlgorithm', e.target.value as ResizeAlgorithm)}
          >
            <option value="nearest">Nearest Neighbour</option>
            <option value="bilinear">Bilinear</option>
            <option value="lanczos">Lanczos</option>
          </select>
        </div>
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
        <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Preprocessing
          {(settings.brightness !== 0 || settings.contrast !== 0 || settings.saturation !== 0) && (
            <button
              className="palette-filter-btn"
              style={{ fontSize: 10, padding: '1px 6px', margin: 0 }}
              onClick={() => {
                onSettingChange('brightness', 0);
                onSettingChange('contrast', 0);
                onSettingChange('saturation', 0);
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Brightness</label>
          <SliderWithInput
            value={settings.brightness}
            min={-100}
            max={100}
            onChange={(v, debounce) => onSettingChange('brightness', v, debounce)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Contrast</label>
          <SliderWithInput
            value={settings.contrast}
            min={-100}
            max={100}
            onChange={(v, debounce) => onSettingChange('contrast', v, debounce)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Saturation</label>
          <SliderWithInput
            value={settings.saturation}
            min={-100}
            max={100}
            onChange={(v, debounce) => onSettingChange('saturation', v, debounce)}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Transparency</div>

        <div className="form-group">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={settings.transparencyEnabled}
              onChange={e => onSettingChange('transparencyEnabled', e.target.checked)}
            />
            Preserve Transparency
          </label>
        </div>

        {settings.transparencyEnabled && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Alpha Threshold</label>
            <SliderWithInput
              value={settings.transparencyThreshold}
              min={0}
              max={255}
              onChange={(v, debounce) => onSettingChange('transparencyThreshold', v, debounce)}
            />
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Canvas Background</div>

        <div className="form-group" style={{ marginBottom: settings.canvasBackground === 'custom' ? 8 : 0 }}>
          <select
            className="form-select"
            value={settings.canvasBackground}
            onChange={e => onSettingChange('canvasBackground', e.target.value as CanvasBackground)}
          >
            <option value="checkerboard">Checkerboard</option>
            <option value="white">White</option>
            <option value="mid_grey">Mid Grey</option>
            <option value="dark_grey">Dark Grey</option>
            <option value="black">Black</option>
            <option value="custom">Custom...</option>
          </select>
        </div>

        {settings.canvasBackground === 'custom' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Custom Colour</label>
            <input
              type="color"
              className="form-colour-picker"
              value={settings.customBackgroundColour}
              onChange={e => onSettingChange('customBackgroundColour', e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
