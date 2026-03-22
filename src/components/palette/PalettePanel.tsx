// Right sidebar — colour palette panel

import React, { useState, useMemo, useCallback, useRef } from 'react';
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
  x: number;
  y: number;
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

  const handleMouseEnter = useCallback((e: React.MouseEvent, entry: PaletteEntry) => {
    if (!coloursData) return;
    const cs = coloursData[entry.colourSetId.toString()];
    if (!cs) return;

    const firstBlock = Object.values(cs.blocks)[0] as any;
    setTooltip({
      x: e.clientX + 12,
      y: e.clientY - 8,
      entry,
      blockName: firstBlock?.displayName || 'Unknown',
      colourName: cs.colourName || 'Unknown',
    });
  }, [coloursData]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="right-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Palette</div>
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
                onMouseMove={e => {
                  if (tooltip) {
                    setTooltip(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 8 } : null);
                  }
                }}
              />
            );
          })
        ))}
      </div>

      {tooltip && (
        <div
          className="palette-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="tt-name">{tooltip.blockName}</div>
          <div>{tooltip.colourName} ({tooltip.entry.tone})</div>
          <div className="tt-rgb">
            RGB({tooltip.entry.rgb[0]}, {tooltip.entry.rgb[1]}, {tooltip.entry.rgb[2]})
          </div>
          <div className="tt-rgb">ID: {tooltip.entry.colourSetId}</div>
        </div>
      )}
    </div>
  );
};
