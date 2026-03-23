// Right sidebar — colour palette panel with block selection and enable/disable

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
  blockChoices: Record<number, number>;
  disabledColourSets: number[];
  onSelectColour: (colourSetId: number, tone: ToneVariant) => void;
  onFilterChange: (carpetOnly: boolean) => void;
  onBlockChoiceChange: (colourSetId: number, blockIndex: number) => void;
  onToggleColourSet: (colourSetId: number) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

interface TooltipInfo {
  anchorX: number;
  anchorY: number;
  entry: PaletteEntry;
  blockName: string;
  colourName: string;
}

interface BlockPickerInfo {
  colourSetId: number;
  anchorX: number;
  anchorY: number;
  blocks: { index: number; displayName: string }[];
}

/**
 * Convert RGB (0-255) to HSL. Returns [hue (0-360), saturation (0-1), lightness (0-1)].
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

export const PalettePanel: React.FC<PalettePanelProps> = ({
  palette, coloursData, selectedColourSetId, selectedTone,
  mapMode, carpetOnly, blockChoices, disabledColourSets,
  onSelectColour, onFilterChange, onBlockChoiceChange,
  onToggleColourSet, onEnableAll, onDisableAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [blockPicker, setBlockPicker] = useState<BlockPickerInfo | null>(null);
  const disabledSet = useMemo(() => new Set(disabledColourSets), [disabledColourSets]);

  // Build full list of all colour sets (including disabled ones for the enable/disable UI)
  const allColourSets = useMemo(() => {
    if (!coloursData) return [];
    const sets: { csId: number; name: string; entries: PaletteEntry[]; disabled: boolean; hue: number; sat: number; light: number }[] = [];

    // Build a map of palette entries per colour set
    const csMap = new Map<number, PaletteEntry[]>();
    for (const entry of palette) {
      if (!csMap.has(entry.colourSetId)) csMap.set(entry.colourSetId, []);
      csMap.get(entry.colourSetId)!.push(entry);
    }

    for (const [key, colourSet] of Object.entries(coloursData)) {
      const csId = parseInt(key);
      const cs = colourSet as any;
      const isDisabled = disabledSet.has(csId);

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = cs.colourName?.toLowerCase().includes(q);
        const blockMatch = Object.values(cs.blocks).some(
          (b: any) => b.displayName?.toLowerCase().includes(q)
        );
        if (!nameMatch && !blockMatch) continue;
      }

      // For carpet only, skip non-carpet sets
      if (carpetOnly) {
        const hasCarpet = Object.values(cs.blocks).some(
          (b: any) => b.displayName?.toLowerCase().includes('carpet') && !b.displayName?.toLowerCase().includes('moss')
        );
        if (!hasCarpet) continue;
      }

      // Use palette entries if they exist, else create placeholder entries for disabled sets
      let entries = csMap.get(csId) || [];
      if (isDisabled && entries.length === 0) {
        const tones: ToneVariant[] = mapMode === 'flat' ? ['normal'] : ['dark', 'normal', 'light'];
        entries = tones.map(tone => {
          const rgb = cs.tonesRGB?.[tone] as [number, number, number] || [128, 128, 128];
          return { colourSetId: csId, tone, rgb };
        });
      }

      if (entries.length === 0) continue;

      // Compute HSL from the normal tone (or first available tone) for sorting
      const normalEntry = entries.find(e => e.tone === 'normal') || entries[0];
      const [h, s, l] = rgbToHsl(normalEntry.rgb[0], normalEntry.rgb[1], normalEntry.rgb[2]);

      sets.push({
        csId, name: cs.colourName || `Colour ${csId}`, entries, disabled: isDisabled,
        hue: h, sat: s, light: l,
      });
    }

    // Sort: greyscale (saturation < 10%) at end sorted by lightness,
    // chromatic sorted by hue then lightness
    const GREY_THRESHOLD = 0.10;
    sets.sort((a, b) => {
      const aGrey = a.sat < GREY_THRESHOLD;
      const bGrey = b.sat < GREY_THRESHOLD;
      if (aGrey !== bGrey) return aGrey ? 1 : -1; // greys at end
      if (aGrey && bGrey) return a.light - b.light; // greys by lightness
      if (a.hue !== b.hue) return a.hue - b.hue; // by hue
      return a.light - b.light; // within same hue, by lightness
    });

    return sets;
  }, [coloursData, palette, searchQuery, disabledSet, carpetOnly, mapMode]);

  const tooltipRef = useRef<HTMLDivElement>(null);

  const getBlockName = useCallback((colourSetId: number) => {
    if (!coloursData) return 'Unknown';
    const cs = coloursData[colourSetId.toString()];
    if (!cs) return 'Unknown';
    const blockIdx = blockChoices[colourSetId] ?? 0;
    const block = cs.blocks[blockIdx.toString()] || Object.values(cs.blocks)[0];
    return (block as any)?.displayName || 'Unknown';
  }, [coloursData, blockChoices]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, entry: PaletteEntry) => {
    if (!coloursData) return;
    const cs = coloursData[entry.colourSetId.toString()];
    if (!cs) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      anchorX: rect.left,
      anchorY: rect.top + rect.height / 2,
      entry,
      blockName: getBlockName(entry.colourSetId),
      colourName: cs.colourName || 'Unknown',
    });
  }, [coloursData, getBlockName]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: PaletteEntry) => {
    e.preventDefault();
    if (!coloursData) return;
    const cs = coloursData[entry.colourSetId.toString()];
    if (!cs) return;

    const blocks = Object.entries(cs.blocks).map(([idx, block]: [string, any]) => ({
      index: parseInt(idx),
      displayName: block.displayName || `Block ${idx}`,
    }));

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setBlockPicker({
      colourSetId: entry.colourSetId,
      anchorX: rect.left,
      anchorY: rect.bottom + 4,
      blocks,
    });
  }, [coloursData]);

  // Position tooltip
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

    if (left < 4) left = tooltip.anchorX + 24 + gap;
    if (left + w > vw - 4) left = vw - w - 4;
    if (top < 4) top = 4;
    if (top + h > vh - 4) top = vh - h - 4;

    setTooltipStyle({ left, top, visibility: 'visible' });
  }, [tooltip]);

  // Close block picker when clicking outside
  useEffect(() => {
    if (!blockPicker) return;
    const handleClick = () => setBlockPicker(null);
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [blockPicker]);

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
          <button className="palette-filter-btn" onClick={onEnableAll}>All On</button>
          <button className="palette-filter-btn" onClick={onDisableAll}>All Off</button>
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
        {allColourSets.map(group => (
          group.entries.map(entry => {
            const isSelected =
              entry.colourSetId === selectedColourSetId && entry.tone === selectedTone;
            return (
              <div
                key={`${entry.colourSetId}-${entry.tone}`}
                className={`palette-swatch ${isSelected ? 'selected' : ''} ${group.disabled ? 'disabled' : ''}`}
                style={{
                  backgroundColor: `rgb(${entry.rgb[0]},${entry.rgb[1]},${entry.rgb[2]})`,
                }}
                onClick={() => {
                  if (group.disabled) {
                    onToggleColourSet(entry.colourSetId);
                  } else {
                    onSelectColour(entry.colourSetId, entry.tone);
                  }
                }}
                onContextMenu={e => handleContextMenu(e, entry)}
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
          <div className="tt-hint">Right-click: change block / toggle</div>
        </div>
      )}

      {blockPicker && (
        <div
          className="block-picker"
          style={{ left: Math.max(4, blockPicker.anchorX - 180), top: blockPicker.anchorY }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="block-picker-title">
            Choose Block
            <button
              className="block-picker-toggle"
              onClick={() => {
                onToggleColourSet(blockPicker.colourSetId);
                setBlockPicker(null);
              }}
            >
              {disabledSet.has(blockPicker.colourSetId) ? 'Enable' : 'Disable'}
            </button>
          </div>
          {blockPicker.blocks.map(b => (
            <div
              key={b.index}
              className={`block-picker-item ${(blockChoices[blockPicker.colourSetId] ?? 0) === b.index ? 'active' : ''}`}
              onClick={() => {
                onBlockChoiceChange(blockPicker.colourSetId, b.index);
                setBlockPicker(null);
              }}
            >
              {b.displayName}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
