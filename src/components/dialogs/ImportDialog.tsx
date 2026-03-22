// Image import dialog — handles image upload, map size, and resize algorithm only.
// Conversion settings (dithering, preprocessing, etc.) are in the SettingsPanel.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ResizeAlgorithm, MAP_SIZE,
} from '../../types';
import { calculateDefaultMapSize, resizeImage } from '../../utils/imageProcessing';

interface ImportDialogProps {
  sourceImage: HTMLImageElement | null;
  onImport: (
    mapWidth: number,
    mapHeight: number,
    sourceImageData: ImageData,
    originalImageData: ImageData,
    resizeAlgorithm: ResizeAlgorithm
  ) => void;
  onClose: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  sourceImage, onImport, onClose,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const defaultSize = sourceImage
    ? calculateDefaultMapSize(sourceImage.width, sourceImage.height)
    : { mapWidth: 1, mapHeight: 1 };

  const [mapWidth, setMapWidth] = useState(defaultSize.mapWidth);
  const [mapHeight, setMapHeight] = useState(defaultSize.mapHeight);
  const [resizeAlgorithm, setResizeAlgorithm] = useState<ResizeAlgorithm>('bilinear');

  const pixelWidth = mapWidth * MAP_SIZE;
  const pixelHeight = mapHeight * MAP_SIZE;

  // Generate preview (just the resized image, no conversion)
  const updatePreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !sourceImage) return;

    const maxDim = 256;
    const scale = Math.min(maxDim / pixelWidth, maxDim / pixelHeight, 1);
    const w = Math.max(1, Math.round(pixelWidth * scale));
    const h = Math.max(1, Math.round(pixelHeight * scale));

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    if (resizeAlgorithm === 'nearest') {
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = resizeAlgorithm === 'lanczos' ? 'high' : 'medium';
    }
    ctx.drawImage(sourceImage, 0, 0, w, h);
  }, [sourceImage, pixelWidth, pixelHeight, resizeAlgorithm]);

  useEffect(() => {
    const timer = setTimeout(updatePreview, 50);
    return () => clearTimeout(timer);
  }, [updatePreview]);

  const handleImport = () => {
    if (!sourceImage) return;

    // Create sourceImageData at target map dimensions
    const sourceImageData = resizeImage(sourceImage, pixelWidth, pixelHeight, resizeAlgorithm);

    // Create originalImageData at full original resolution
    const origCanvas = document.createElement('canvas');
    origCanvas.width = sourceImage.width;
    origCanvas.height = sourceImage.height;
    const origCtx = origCanvas.getContext('2d')!;
    origCtx.drawImage(sourceImage, 0, 0);
    const originalImageData = origCtx.getImageData(0, 0, sourceImage.width, sourceImage.height);

    onImport(mapWidth, mapHeight, sourceImageData, originalImageData, resizeAlgorithm);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 450, maxWidth: 550 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Import Image</div>

        <div className="import-preview" style={{ flexDirection: 'column', alignItems: 'center' }}>
          <canvas
            ref={previewCanvasRef}
            style={{ width: 256, height: 256, objectFit: 'contain' }}
          />
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>
            {sourceImage ? `${sourceImage.width}x${sourceImage.height}` : ''} → {pixelWidth}x{pixelHeight} px
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
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

          <div className="dimension-display" style={{ marginBottom: 12 }}>
            {mapWidth}x{mapHeight} maps = {pixelWidth}x{pixelHeight} pixels
            {mapWidth * mapHeight > 100 && (
              <span style={{ color: 'var(--warning)', marginLeft: 8 }}>Large!</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Resize Algorithm</label>
            <select
              className="form-select"
              value={resizeAlgorithm}
              onChange={e => setResizeAlgorithm(e.target.value as ResizeAlgorithm)}
            >
              <option value="nearest">Nearest Neighbour</option>
              <option value="bilinear">Bilinear</option>
              <option value="lanczos">Lanczos</option>
            </select>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            Conversion settings (dithering, brightness, etc.) can be adjusted live after import from the Settings panel.
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
