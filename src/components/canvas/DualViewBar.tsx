// Compact settings bar for dual map view — shown above the right comparison pane

import React from 'react';
import { ConversionSettings, DitherMethod } from '../../types';

interface DualViewBarProps {
  settings: ConversionSettings;
  onSettingChange: <K extends keyof ConversionSettings>(key: K, value: ConversionSettings[K], debounce?: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

export const DualViewBar: React.FC<DualViewBarProps> = ({
  settings, onSettingChange, onApply, onClose,
}) => {
  return (
    <div className="dual-view-bar">
      <div className="dual-bar-row">
        <label className="dual-bar-label">Dither</label>
        <select
          className="dual-bar-select"
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

        <label className="dual-bar-label">
          <input
            type="checkbox"
            checked={settings.betterColour}
            onChange={e => onSettingChange('betterColour', e.target.checked)}
          />
          Lab
        </label>

        <div className="dual-bar-sep" />

        <label className="dual-bar-label">Brt</label>
        <input
          type="range" className="dual-bar-slider"
          min={-100} max={100} value={settings.brightness}
          onChange={e => onSettingChange('brightness', parseInt(e.target.value), true)}
        />
        <span className="dual-bar-val">{settings.brightness}</span>

        <label className="dual-bar-label">Con</label>
        <input
          type="range" className="dual-bar-slider"
          min={-100} max={100} value={settings.contrast}
          onChange={e => onSettingChange('contrast', parseInt(e.target.value), true)}
        />
        <span className="dual-bar-val">{settings.contrast}</span>

        <label className="dual-bar-label">Sat</label>
        <input
          type="range" className="dual-bar-slider"
          min={-100} max={100} value={settings.saturation}
          onChange={e => onSettingChange('saturation', parseInt(e.target.value), true)}
        />
        <span className="dual-bar-val">{settings.saturation}</span>

        <div className="dual-bar-sep" />

        <button className="dual-bar-btn dual-bar-apply" onClick={onApply} title="Apply right-side settings to project">
          Apply Right Settings
        </button>
        <button className="dual-bar-btn dual-bar-close" onClick={onClose} title="Close dual view">
          {'\u2715'}
        </button>
      </div>
    </div>
  );
};
