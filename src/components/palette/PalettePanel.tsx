// Right sidebar — colour palette panel

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ToneVariant, MapMode } from '../../types';
import { PaletteEntry } from '../../types';

interface PalettePanelProps {
  palette: PaletteEntry[];
  coloursData: Record<string, any> | null;
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  mapMode: MapMode;
  carpetOnly: boolean;
  onSelectColour: (colourSetId: number, tone: ToneVariant) => void;
  onFilterChange: (carpetOnly: boolean) => void;
}

interface TooltipInfo {
  anchorX: number;
  anchorY: number;
  entry: PaletteEntry;
  blockName: string;
  colourName: string;
}

export const PalettePanel: React.FC<PalettePanelProps> = ({
  palette, coloursData, selectedColourSetId, selectedTone,
  mapMode, carpetOnly, onSelectColour, onFilterChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Group palette entries by colour set
  const groupedPalette = useMemo(() => {
    if (!coloursData) return [];

    const groups: { csId: number; name: string; entries: PaletteEntry[] }[] = [];
    const csMap = new Map<number, PaletteEntry[]>();

    for (const entry of palette) {
      if (!csMap.has(entry.colourSetId)) {
        csMap.set(entry.colourSetId, []);
      }
      csMap.get(entry.colourSetId)!.push(entry);
    }

    for (const [csId, entries] of csMap) {
      const cs = coloursData[csId.toString()];
      if (!cs) continue;

      // Apply search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = cs.colourName?.toLowerCase().includes(q);
        const blockMatch = Object.values(cs.blocks).some(
          (b: any) => b.displayName?.toLowerCase().includes(q)
        );
        if (!nameMatch && !blockMatch) continue;
      }

      groups.push({
        csId,
        name: cs.colourName || `Colour ${csId}`,
        entries,
      });
    }

    return groups;
  }, [palette, coloursData, searchQuery]);

  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent, entry: PaletteEntry) => {
    if (!coloursData) return;
    const cs = coloursData[entry.colourSetId.toString()];
    if (!cs) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const firstBlock = Object.values(cs.blocks)[0] as any;
    setTooltip({
      anchorX: rect.left,
      anchorY: rect.top + rect.height / 2,
      entry,
      blockName: firstBlock?.displayName || 'Unknown',
      colourName: cs.colourName || 'Unknown',
    });
  }, [coloursData]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Position tooltip with viewport-aware bounds checking
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = tooltip.anchorX - w - gap;
    let top = tooltip.anchorY - h / 2;

    // If overflows left, flip to right of anchor
    if (left < 4) {
      left = tooltip.anchorX + 24 + gap;
    }
    // If overflows right after flip, clamp
    if (left + w > vw - 4) {
      left = vw - w - 4;
    }
    // Clamp vertical
    if (top < 4) top = 4;
    if (top + h > vh - 4) top = vh - h - 4;

    setTooltipStyle({ left, top, visibility: 'visible' });
  }, [tooltip]);

  return (
    <div className="palette-panel-content">
      <div className="sidebar-section">
        <div className="palette-filter-bar">
          <button
            className={`palette-filter-btn ${!carpetOnly ? 'active' : ''}`}
            onClick={() => onFilterChange(false)}
          >
            All Blocks
          </button>
          <button
            className={`palette-filter-btn ${carpetOnly ? 'active' : ''}`}
            onClick={() => onFilterChange(true)}
          >
            Carpet Only
          </button>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <input
            className="palette-search"
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="palette-grid">
        {groupedPalette.map(group => (
          group.entries.map(entry => {
            const isSelected =
              entry.colourSetId === selectedColourSetId && entry.tone === selectedTone;
            return (
              <div
                key={`${entry.colourSetId}-${entry.tone}`}
                className={`palette-swatch ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: `rgb(${entry.rgb[0]},${entry.rgb[1]},${entry.rgb[2]})`,
                }}
                onClick={() => onSelectColour(entry.colourSetId, entry.tone)}
                onMouseEnter={e => handleMouseEnter(e, entry)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })
        ))}
      </div>

      {tooltip && (
        <div
          ref={tooltipRef}
          className="palette-tooltip"
          style={{ ...tooltipStyle, visibility: tooltipStyle.visibility as any || 'hidden' }}
        >
          <div className="tt-name">{tooltip.blockName}</div>
          <div>{tooltip.colourName} ({tooltip.entry.tone})</div>
          <div className="tt-rgb">
            RGB({tooltip.entry.rgb[0]}, {tooltip.entry.rgb[1]}, {tooltip.entry.rgb[2]})
          </div>
        </div>
      )}
    </div>  );
};
