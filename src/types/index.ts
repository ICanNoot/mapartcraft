// Core types for MapArt Studio

export type ToneVariant = 'dark' | 'normal' | 'light' | 'unobtainable';
export type ShadeId = 0 | 1 | 2 | 3; // dark=0, normal=1, light=2, unobtainable=3

export const SHADE_MULTIPLIERS: Record<ShadeId, number> = {
  0: 180 / 255, // dark
  1: 220 / 255, // normal
  2: 255 / 255, // light
  3: 135 / 255, // unobtainable
};

export const TONE_TO_SHADE: Record<ToneVariant, ShadeId> = {
  dark: 0,
  normal: 1,
  light: 2,
  unobtainable: 3,
};

export interface BlockInfo {
  displayName: string;
  validVersions: Record<string, { NBTName: string; NBTArgs: Record<string, string> } | string>;
  supportBlockMandatory: boolean;
  flammable: boolean;
  presetIndex: number;
}

export interface ColourSet {
  tonesRGB: Record<ToneVariant, [number, number, number]>;
  blocks: Record<string, BlockInfo>;
  mapdatId: number;
  colourName: string;
}

export type ColoursJSON = Record<string, ColourSet>;

export interface PaletteEntry {
  colourSetId: number;
  tone: ToneVariant;
  rgb: [number, number, number];
  lab?: [number, number, number];
}

export interface PixelData {
  colourSetId: number; // -1 for empty/air
  tone: ToneVariant;
  blockIndex: number; // index within the colour set's blocks
}

export type MapMode = 'flat' | 'staircase';
export type StaircaseMode = 'classic' | 'valley' | 'full_dark' | 'full_light';
export type DitherMethod = 'none' | 'floyd_steinberg' | 'bayer_4x4' | 'bayer_2x2' | 'ordered_3x3' | 'minavgerr' | 'burkes' | 'sierra_lite' | 'stucki' | 'atkinson';
export type ResizeAlgorithm = 'nearest' | 'bilinear' | 'lanczos';
export type SupportBlockMode = 'none' | 'important_only' | 'all_optimized' | 'all_double_optimized';
export type CanvasBackground = 'checkerboard' | 'white' | 'mid_grey' | 'dark_grey' | 'black' | 'custom';

export type ToolType = 'pencil' | 'eraser' | 'eyedropper' | 'fill' | 'selection';

export interface ConversionSettings {
  mapMode: MapMode;
  staircaseMode: StaircaseMode;
  ditherMethod: DitherMethod;
  resizeAlgorithm: ResizeAlgorithm;
  betterColour: boolean;
  carpetOnly: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  transparencyEnabled: boolean;
  transparencyThreshold: number; // 0-255, pixels with alpha below this → EMPTY_PIXEL
  canvasBackground: CanvasBackground;
  customBackgroundColour: string; // hex colour for custom background
}

export interface ProjectState {
  mapWidth: number;  // in maps
  mapHeight: number; // in maps
  pixelWidth: number;  // mapWidth * 128
  pixelHeight: number; // mapHeight * 128
  pixels: Uint16Array; // colourSetId * 4 + toneIndex encoded; 0xFFFF = empty
  blockChoices: Record<number, number>; // colourSetId -> chosen blockIndex
  disabledColourSets: number[]; // colourSetIds that are disabled
  conversionSettings: ConversionSettings;
  sourceImageData: ImageData | null; // resized to current map dimensions, before conversion
  originalImageData: ImageData | null; // original resolution, for re-resizing on map size change
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HistoryEntry {
  pixels: Uint16Array;
  description: string;
}

export const EMPTY_PIXEL = 0xFFFF;

export function encodePixel(colourSetId: number, tone: ToneVariant): number {
  if (colourSetId < 0) return EMPTY_PIXEL;
  const toneIdx = tone === 'dark' ? 0 : tone === 'normal' ? 1 : tone === 'light' ? 2 : 3;
  return colourSetId * 4 + toneIdx;
}

export function decodePixel(encoded: number): { colourSetId: number; tone: ToneVariant } | null {
  if (encoded === EMPTY_PIXEL) return null;
  const colourSetId = Math.floor(encoded / 4);
  const toneIdx = encoded % 4;
  const tones: ToneVariant[] = ['dark', 'normal', 'light', 'unobtainable'];
  return { colourSetId, tone: tones[toneIdx] };
}

export const MAP_SIZE = 128;
export const DATA_VERSION_1_20 = 3463;

export const DEFAULT_CONVERSION_SETTINGS: ConversionSettings = {
  mapMode: 'flat',
  staircaseMode: 'classic',
  ditherMethod: 'floyd_steinberg',
  resizeAlgorithm: 'bilinear',
  betterColour: false,
  carpetOnly: true,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  transparencyEnabled: true,
  transparencyThreshold: 128,
  canvasBackground: 'checkerboard',
  customBackgroundColour: '#ff00ff',
};

export type ExportFormat = 'schematic' | 'mapdat';

export interface ExportSettings {
  filename: string;
  splitExport: boolean;
  supportBlockMode: SupportBlockMode;
  supportBlockType: string; // NBT name like "stone"
  version: string;
  exportFormat: ExportFormat;
  startingMapId: number; // For map.dat export
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export interface MaterialEntry {
  blockName: string;
  nbtName: string;
  count: number;
  colourSetId: number;
}

export interface RecentProject {
  name: string;
  date: string;
  mapWidth: number;
  mapHeight: number;
  thumbnail: string; // data URL
}

// Recent colour entry for quick palette access
export interface RecentColour {
  colourSetId: number;
  tone: ToneVariant;
}

// App-level preferences (persisted in localStorage, separate from per-project settings)
export interface AppPreferences {
  showMinimap: boolean;
  showFloatingColourBox: boolean;
  rightClickPopupPalette: boolean;
  autoExpandPaletteWhenDrawing: boolean;
  splitViewMode: boolean;
  showDifferenceOverlay: boolean;
  beforeAfterHoldKey: string; // 'Tab' | 'Backslash'
  recentColoursCount: number;
  defaultExportFormat: ExportFormat;
  defaultSupportBlockMode: SupportBlockMode;
  defaultSupportBlockType: string;
  rememberLastExportSettings: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  showMinimap: true,
  showFloatingColourBox: true,
  rightClickPopupPalette: true,
  autoExpandPaletteWhenDrawing: true,
  splitViewMode: false,
  showDifferenceOverlay: false,
  beforeAfterHoldKey: 'Tab',
  recentColoursCount: 10,
  defaultExportFormat: 'schematic',
  defaultSupportBlockMode: 'important_only',
  defaultSupportBlockType: 'stone',
  rememberLastExportSettings: true,
};

// Toast notification
export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number; // ms, default 3000
}
