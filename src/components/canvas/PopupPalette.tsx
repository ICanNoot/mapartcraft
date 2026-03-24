// Right-click popup palette — compact colour picker at cursor position

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ToneVariant, RecentColour, PaletteEntry } from '../../types';

interface PopupPaletteProps {
  x: number;
  y: number;
  palette: PaletteEntry[];
  coloursData: Record<string, any> | null;
  recentColours: RecentColour[];
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  disabledColourSets: number[];
  onSelectColour: (colourSetId: number, tone: ToneVariant) => void;
  onClose: () => void;
}

export const PopupPalette: React.FC<PopupPaletteProps> = ({
  x, y, palette, coloursData, recentColours,
  selectedColourSetId, selectedTone, disabledColourSets,
  onSelectColour, onClose,
}) => {
  const [search, setSearch] = useState('');
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const disabledSet = useMemo(() => new Set(disabledColourSets), [disabledColourSets]);

  // Focus search on open
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 10);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        doClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') doClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const doClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 100);
  }, [onClose]);

  const handleSelect = useCallback((colourSetId: number, tone: ToneVariant) => {
    onSelectColour(colourSetId, tone);
    doClose();
  }, [onSelectColour, doClose]);

  // Filter palette by search
  const filteredPalette = useMemo(() => {
    if (!search.trim()) return palette;
    const q = search.toLowerCase();
    return palette.filter(entry => {
      const cs = coloursData?.[entry.colourSetId.toString()];
      if (!cs) return false;
      const colourName = (cs.colourName || '').toLowerCase();
      const blockNames = Object.values(cs.blocks || {}).map(
        (b: any) => (b.displayName || '').toLowerCase()
      );
      return colourName.includes(q) || blockNames.some((n: string) => n.includes(q));
    });
  }, [palette, coloursData, search]);

  // Get recent colour RGBs
  const recentEntries = useMemo(() => {
    return recentColours.map(rc => {
      const cs = coloursData?.[rc.colourSetId.toString()];
      const rgb = cs?.tonesRGB?.[rc.tone] as [number, number, number] | undefined;
      return { ...rc, rgb };
    }).filter(e => e.rgb);
  }, [recentColours, coloursData]);

  // Clamp to viewport
  const popupW = 280;
  const popupH = 360;
  const clampedX = Math.min(x, window.innerWidth - popupW - 8);
  const clampedY = Math.min(y, window.innerHeight - popupH - 8);

  return (
    <div
      ref={ref}
      className={`popup-palette ${closing ? 'closing' : ''}`}
      style={{
        left: Math.max(8, clampedX),
        top: Math.max(8, clampedY),
      }}
    >
      <input
        ref={searchRef}
        className="popup-palette-search"
        placeholder="Search blocks..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') doClose(); }}
      />

      {recentEntries.length > 0 && !search && (
        <div className="popup-section">
          <div className="popup-section-label">Recent</div>
          <div className="popup-swatch-grid">
            {recentEntries.map((rc, i) => (
              <div
                key={i}
                className={`popup-swatch ${
                  rc.colourSetId === selectedColourSetId && rc.tone === selectedTone ? 'selected' : ''
                }`}
                style={{ backgroundColor: rc.rgb ? `rgb(${rc.rgb[0]},${rc.rgb[1]},${rc.rgb[2]})` : '#333' }}
                onClick={() => handleSelect(rc.colourSetId, rc.tone)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="popup-section popup-section-palette">
        <div className="popup-swatch-grid">
          {filteredPalette.map(entry => {
            if (disabledSet.has(entry.colourSetId)) return null;
            const isSelected = entry.colourSetId === selectedColourSetId && entry.tone === selectedTone;
            return (
              <div
                key={`${entry.colourSetId}-${entry.tone}`}
                className={`popup-swatch ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: `rgb(${entry.rgb[0]},${entry.rgb[1]},${entry.rgb[2]})`,
                }}
                onClick={() => handleSelect(entry.colourSetId, entry.tone)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
