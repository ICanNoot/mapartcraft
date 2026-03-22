// Image import dialog with resize, conversion settings, and preview

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ConversionSettings, MapMode, StaircaseMode, DitherMethod,
  ResizeAlgorithm, MAP_SIZE, DEFAULT_CONVERSION_SETTINGS,
} from '../../types';
import { calculateDefaultMapSize, resizeImage, applyPreprocessing } from '../../utils/imageProcessing';
import { buildPalette } from '../../utils/colour';
import { applyDithering } from '../../utils/dither';

interface ImportDialogProps {
  sourceImage: HTMLImageElement | null;
  coloursData: Record<string, any>;
  onImport: (
    mapWidth: number,
    mapHeight: number,
    imageData: ImageData,
    settings: ConversionSettings
  ) => void;
  onClose: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  sourceImage, coloursData, onImport, onClose,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const defaultSize = sourceImage
    ? calculateDefaultMapSize(sourceImage.width, sourceImage.height)
    : { mapWidth: 1, mapHeight: 1 };

  const [mapWidth, setMapWidth] = useState(defaultSize.mapWidth);
  const [mapHeight, setMapHeight] = useState(defaultSize.mapHeight);
  const [settings, setSettings] = useState<ConversionSettings>(DEFAULT_CONVERSION_SETTINGS);

  const pixelWidth = mapWidth * MAP_SIZE;
  const pixelHeight = mapHeight * MAP_SIZE;

  // Generate preview
  const updatePreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !sourceImage) return;

    const previewW = Math.min(pixelWidth, 256);
    const previewH = Math.min(pixelHeight, 256);
    const scale = Math.min(previewW / pixelWidth, previewH / pixelHeight);
    const w = Math.round(pixelWidth * scale);
    const h = Math.round(pixelHeight * scale);

    canvas.width = w;
    canvas.height = h;

    // Resize and convert at preview resolution
    const imageData = resizeImage(sourceImage, w, h, settings.resizeAlgorithm);

    // Apply preprocessing
    const processed = applyPreprocessing(imageData, settings.brightness, settings.contrast, settings.saturation);

    // Build palette and dither
    const palette = buildPalette(coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour);
    const result = applyDithering(processed.data, w, h, palette, settings.ditherMethod, settings.betterColour);

    // Render preview
    const ctx = canvas.getContext('2d')!;
    const outData = ctx.createImageData(w, h);
    for (let i = 0; i < result.length; i++) {
      const cs = coloursData[result[i].colourSetId.toString()];
      if (cs) {
        const rgb = cs.tonesRGB[result[i].tone];
        outData.data[i * 4] = rgb[0];
        outData.data[i * 4 + 1] = rgb[1];
        outData.data[i * 4 + 2] = rgb[2];
        outData.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(outData, 0, 0);
  }, [sourceImage, pixelWidth, pixelHeight, settings, coloursData]);

  useEffect(() => {
    const timer = setTimeout(updatePreview, 100);
    return () => clearTimeout(timer);
  }, [updatePreview]);

  const handleImport = () => {
    if (!sourceImage) return;
    const imageData = resizeImage(sourceImage, pixelWidth, pixelHeight, settings.resizeAlgorithm);
    onImport(mapWidth, mapHeight, imageData, settings);
  };

  const updateSetting = <K extends keyof ConversionSettings>(
    key: K,
    value: ConversionSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 650, maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Import Image</div>

        <div className="import-preview">
          <div>
            <canvas
              ref={previewCanvasRef}
              style={{ width: 256, height: 256, objectFit: 'contain' }}
            />
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>
              Preview ({pixelWidth} x {pixelHeight} px)
            </div>
          </div>

          <div className="import-settings">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Maps Wide</label>
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
                <label className="form-label">Maps Tall</label>
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

            <div className="dimension-display" style={{ marginBottom: 8 }}>
              {mapWidth}x{mapHeight} maps = {pixelWidth}x{pixelHeight} pixels
              {mapWidth * mapHeight > 100 && (
                <span style={{ color: 'var(--warning)', marginLeft: 8 }}>Large!</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Map Mode</label>
              <select
                className="form-select"
                value={settings.mapMode}
                onChange={e => updateSetting('mapMode', e.target.value as MapMode)}
              >
                <option value="flat">Flat</option>
                <option value="staircase">Staircase</option>
              </select>
            </div>

            {settings.mapMode === 'staircase' && (
              <div className="form-group">
                <label className="form-label">Staircase Mode</label>
                <select
                  className="form-select"
                  value={settings.staircaseMode}
                  onChange={e => updateSetting('staircaseMode', e.target.value as StaircaseMode)}
                >
                  <option value="classic">Classic</option>
                  <option value="valley">Valley</option>
                  <option value="full_dark">Full Dark</option>
                  <option value="full_light">Full Light</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Resize Algorithm</label>
              <select
                className="form-select"
                value={settings.resizeAlgorithm}
                onChange={e => updateSetting('resizeAlgorithm', e.target.value as ResizeAlgorithm)}
              >
                <option value="nearest">Nearest Neighbour</option>
                <option value="bilinear">Bilinear</option>
                <option value="lanczos">Lanczos</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Dithering</label>
              <select
                className="form-select"
                value={settings.ditherMethod}
                onChange={e => updateSetting('ditherMethod', e.target.value as DitherMethod)}
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
                  onChange={e => updateSetting('betterColour', e.target.checked)}
                />
                Better Colour (CIE Lab distance)
              </label>
            </div>

            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  checked={settings.carpetOnly}
                  onChange={e => updateSetting('carpetOnly', e.target.checked)}
                />
                Carpet Only
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Brightness</label>
              <div className="slider-row">
                <input
                  type="range"
                  className="form-slider"
                  min={-100}
                  max={100}
                  value={settings.brightness}
                  onChange={e => updateSetting('brightness', parseInt(e.target.value))}
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
                  onChange={e => updateSetting('contrast', parseInt(e.target.value))}
                />
                <span className="slider-value">{settings.contrast}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Saturation</label>
              <div className="slider-row">
                <input
                  type="range"
                  className="form-slider"
                  min={-100}
                  max={100}
                  value={settings.saturation}
                  onChange={e => updateSetting('saturation', parseInt(e.target.value))}
                />
                <span className="slider-value">{settings.saturation}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!sourceImage}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
};
