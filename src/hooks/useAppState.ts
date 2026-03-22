// Central application state management

import { useState, useCallback, useRef } from 'react';
import {
  ProjectState, ToolType, ConversionSettings, SelectionRect,
  HistoryEntry, EMPTY_PIXEL, MAP_SIZE, DEFAULT_CONVERSION_SETTINGS,
  encodePixel, decodePixel, ToneVariant, ExportSettings,
} from '../types';
import { buildPalette } from '../utils/colour';
import { PaletteEntry } from '../types';
import { applyDithering } from '../utils/dither';
import { resizeImage, applyPreprocessing } from '../utils/imageProcessing';
import { exportProject, bundleAsZip } from '../utils/export';

const MAX_HISTORY = 100;

export interface AppState {
  project: ProjectState | null;
  activeTool: ToolType;
  brushSize: number;
  selectedColourSetId: number;
  selectedTone: ToneVariant;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showMapBorders: boolean;
  cursorX: number;
  cursorY: number;
  selection: SelectionRect | null;
  clipboard: { width: number; height: number; data: Uint16Array } | null;
  palette: PaletteEntry[];
  coloursData: Record<string, any> | null;
  importDialogOpen: boolean;
  exportDialogOpen: boolean;
  sourceImage: HTMLImageElement | null;
}

export function useAppState() {
  const [state, setState] = useState<AppState>({
    project: null,
    activeTool: 'pencil',
    brushSize: 1,
    selectedColourSetId: 0,
    selectedTone: 'normal',
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
    showMapBorders: true,
    cursorX: -1,
    cursorY: -1,
    selection: null,
    clipboard: null,
    palette: [],
    coloursData: null,
    importDialogOpen: false,
    exportDialogOpen: false,
    sourceImage: null,
  });

  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);

  const pushHistory = useCallback((pixels: Uint16Array, description: string) => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;

    // Remove any redo history
    history.splice(idx + 1);

    // Push new entry
    history.push({ pixels: new Uint16Array(pixels), description });

    // Trim if too long
    if (history.length > MAX_HISTORY) {
      history.shift();
    }

    historyIndexRef.current = history.length - 1;
  }, []);

  const undo = useCallback(() => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;

    if (idx > 0) {
      historyIndexRef.current = idx - 1;
      const entry = history[idx - 1];
      setState(prev => {
        if (!prev.project) return prev;
        return {
          ...prev,
          project: { ...prev.project, pixels: new Uint16Array(entry.pixels) },
        };
      });
    }
  }, []);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;

    if (idx < history.length - 1) {
      historyIndexRef.current = idx + 1;
      const entry = history[idx + 1];
      setState(prev => {
        if (!prev.project) return prev;
        return {
          ...prev,
          project: { ...prev.project, pixels: new Uint16Array(entry.pixels) },
        };
      });
    }
  }, []);

  const setTool = useCallback((tool: ToolType) => {
    setState(prev => ({ ...prev, activeTool: tool }));
  }, []);

  const setBrushSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, brushSize: size }));
  }, []);

  const setSelectedColour = useCallback((colourSetId: number, tone: ToneVariant) => {
    setState(prev => ({ ...prev, selectedColourSetId: colourSetId, selectedTone: tone }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(64, zoom)) }));
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    setState(prev => ({ ...prev, panX: x, panY: y }));
  }, []);

  const setCursor = useCallback((x: number, y: number) => {
    setState(prev => ({ ...prev, cursorX: x, cursorY: y }));
  }, []);

  const toggleGrid = useCallback(() => {
    setState(prev => ({ ...prev, showGrid: !prev.showGrid }));
  }, []);

  const toggleMapBorders = useCallback(() => {
    setState(prev => ({ ...prev, showMapBorders: !prev.showMapBorders }));
  }, []);

  const setColoursData = useCallback((data: Record<string, any>) => {
    const palette = buildPalette(data, 'flat', false, false);
    setState(prev => ({ ...prev, coloursData: data, palette }));
  }, []);

  const rebuildPalette = useCallback((settings?: Partial<ConversionSettings>) => {
    setState(prev => {
      if (!prev.coloursData) return prev;
      const cs = settings ? { ...prev.project?.conversionSettings, ...settings } as ConversionSettings : prev.project?.conversionSettings;
      if (!cs) return prev;
      const palette = buildPalette(prev.coloursData, cs.mapMode, cs.carpetOnly, cs.betterColour);
      return { ...prev, palette };
    });
  }, []);

  const openImportDialog = useCallback(() => {
    setState(prev => ({ ...prev, importDialogOpen: true }));
  }, []);

  const closeImportDialog = useCallback(() => {
    setState(prev => ({ ...prev, importDialogOpen: false, sourceImage: null }));
  }, []);

  const setSourceImage = useCallback((img: HTMLImageElement) => {
    setState(prev => ({ ...prev, sourceImage: img }));
  }, []);

  const createProject = useCallback((
    mapWidth: number,
    mapHeight: number,
    imageData: ImageData | null,
    settings: ConversionSettings,
    coloursData: Record<string, any>
  ) => {
    const pixelWidth = mapWidth * MAP_SIZE;
    const pixelHeight = mapHeight * MAP_SIZE;
    const pixels = new Uint16Array(pixelWidth * pixelHeight).fill(EMPTY_PIXEL);

    const palette = buildPalette(coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour);

    if (imageData) {
      // Apply preprocessing
      const processed = applyPreprocessing(
        imageData,
        settings.brightness,
        settings.contrast,
        settings.saturation
      );

      // Apply dithering and colour conversion
      const result = applyDithering(
        processed.data,
        pixelWidth,
        pixelHeight,
        palette,
        settings.ditherMethod,
        settings.betterColour
      );

      // Encode results
      for (let i = 0; i < result.length; i++) {
        pixels[i] = encodePixel(result[i].colourSetId, result[i].tone as ToneVariant);
      }
    }

    const project: ProjectState = {
      mapWidth,
      mapHeight,
      pixelWidth,
      pixelHeight,
      pixels,
      blockChoices: {},
      conversionSettings: settings,
    };

    // Initialize history
    historyRef.current = [{ pixels: new Uint16Array(pixels), description: 'Initial' }];
    historyIndexRef.current = 0;

    setState(prev => ({
      ...prev,
      project,
      palette,
      importDialogOpen: false,
      sourceImage: null,
      zoom: Math.min(
        (window.innerWidth - 520) / pixelWidth,
        (window.innerHeight - 100) / pixelHeight
      ),
      panX: 0,
      panY: 0,
    }));
  }, []);

  const setPixel = useCallback((x: number, y: number, colourSetId: number, tone: ToneVariant) => {
    setState(prev => {
      if (!prev.project) return prev;
      if (x < 0 || x >= prev.project.pixelWidth || y < 0 || y >= prev.project.pixelHeight) return prev;

      const newPixels = new Uint16Array(prev.project.pixels);
      newPixels[y * prev.project.pixelWidth + x] = encodePixel(colourSetId, tone);
      return {
        ...prev,
        project: { ...prev.project, pixels: newPixels },
      };
    });
  }, []);

  const setPixelsBatch = useCallback((changes: { x: number; y: number; encoded: number }[]) => {
    setState(prev => {
      if (!prev.project) return prev;
      const newPixels = new Uint16Array(prev.project.pixels);
      for (const { x, y, encoded } of changes) {
        if (x >= 0 && x < prev.project.pixelWidth && y >= 0 && y < prev.project.pixelHeight) {
          newPixels[y * prev.project.pixelWidth + x] = encoded;
        }
      }
      return {
        ...prev,
        project: { ...prev.project, pixels: newPixels },
      };
    });
  }, []);

  const commitPixels = useCallback((description: string) => {
    setState(prev => {
      if (!prev.project) return prev;
      pushHistory(prev.project.pixels, description);
      return prev;
    });
  }, [pushHistory]);

  const fillArea = useCallback((startX: number, startY: number, colourSetId: number, tone: ToneVariant) => {
    setState(prev => {
      if (!prev.project) return prev;
      const { pixels, pixelWidth, pixelHeight } = prev.project;
      const newPixels = new Uint16Array(pixels);
      const targetEncoded = newPixels[startY * pixelWidth + startX];
      const fillEncoded = encodePixel(colourSetId, tone);

      if (targetEncoded === fillEncoded) return prev;

      const stack: [number, number][] = [[startX, startY]];
      const visited = new Set<number>();

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = y * pixelWidth + x;
        if (visited.has(idx)) continue;
        if (x < 0 || x >= pixelWidth || y < 0 || y >= pixelHeight) continue;
        if (newPixels[idx] !== targetEncoded) continue;

        visited.add(idx);
        newPixels[idx] = fillEncoded;

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      pushHistory(newPixels, 'Fill');
      return {
        ...prev,
        project: { ...prev.project, pixels: newPixels },
      };
    });
  }, [pushHistory]);

  const setSelection = useCallback((sel: SelectionRect | null) => {
    setState(prev => ({ ...prev, selection: sel }));
  }, []);

  const copySelection = useCallback(() => {
    setState(prev => {
      if (!prev.project || !prev.selection) return prev;
      const { pixels, pixelWidth } = prev.project;
      const { x, y, width, height } = prev.selection;
      const data = new Uint16Array(width * height);

      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sx < prev.project.pixelWidth && sy >= 0 && sy < prev.project.pixelHeight) {
            data[dy * width + dx] = pixels[sy * pixelWidth + sx];
          } else {
            data[dy * width + dx] = EMPTY_PIXEL;
          }
        }
      }

      return { ...prev, clipboard: { width, height, data } };
    });
  }, []);

  const pasteClipboard = useCallback((targetX: number, targetY: number) => {
    setState(prev => {
      if (!prev.project || !prev.clipboard) return prev;
      const newPixels = new Uint16Array(prev.project.pixels);
      const { width, height, data } = prev.clipboard;

      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const tx = targetX + dx;
          const ty = targetY + dy;
          if (tx >= 0 && tx < prev.project.pixelWidth && ty >= 0 && ty < prev.project.pixelHeight) {
            const val = data[dy * width + dx];
            if (val !== EMPTY_PIXEL) {
              newPixels[ty * prev.project.pixelWidth + tx] = val;
            }
          }
        }
      }

      pushHistory(newPixels, 'Paste');
      return {
        ...prev,
        project: { ...prev.project, pixels: newPixels },
      };
    });
  }, [pushHistory]);

  const deleteSelection = useCallback(() => {
    setState(prev => {
      if (!prev.project || !prev.selection) return prev;
      const newPixels = new Uint16Array(prev.project.pixels);
      const { x, y, width, height } = prev.selection;

      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sx < prev.project.pixelWidth && sy >= 0 && sy < prev.project.pixelHeight) {
            newPixels[sy * prev.project.pixelWidth + sx] = EMPTY_PIXEL;
          }
        }
      }

      pushHistory(newPixels, 'Delete selection');
      return {
        ...prev,
        project: { ...prev.project, pixels: newPixels },
        selection: null,
      };
    });
  }, [pushHistory]);

  const openExportDialog = useCallback(() => {
    setState(prev => ({ ...prev, exportDialogOpen: true }));
  }, []);

  const closeExportDialog = useCallback(() => {
    setState(prev => ({ ...prev, exportDialogOpen: false }));
  }, []);

  const doExport = useCallback(async (settings: ExportSettings) => {
    const currentState = state;
    if (!currentState.project || !currentState.coloursData) return;

    const files = await exportProject(currentState.project, currentState.coloursData, settings);

    if (files.length === 1) {
      // Single file download
      downloadFile(files[0].filename, files[0].data);
    } else {
      // Bundle as ZIP
      const zipData = await bundleAsZip(files);
      downloadFile(`${settings.filename}.zip`, zipData);
    }
  }, [state]);

  const saveProject = useCallback(() => {
    if (!state.project) return;
    const data = {
      version: 1,
      mapWidth: state.project.mapWidth,
      mapHeight: state.project.mapHeight,
      pixelWidth: state.project.pixelWidth,
      pixelHeight: state.project.pixelHeight,
      pixels: Array.from(state.project.pixels),
      blockChoices: state.project.blockChoices,
      conversionSettings: state.project.conversionSettings,
    };
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.mapstudio';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.project]);

  const loadProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const pixels = new Uint16Array(data.pixels);

        const project: ProjectState = {
          mapWidth: data.mapWidth,
          mapHeight: data.mapHeight,
          pixelWidth: data.pixelWidth,
          pixelHeight: data.pixelHeight,
          pixels,
          blockChoices: data.blockChoices || {},
          conversionSettings: data.conversionSettings || DEFAULT_CONVERSION_SETTINGS,
        };

        historyRef.current = [{ pixels: new Uint16Array(pixels), description: 'Loaded' }];
        historyIndexRef.current = 0;

        setState(prev => ({
          ...prev,
          project,
          zoom: Math.min(
            (window.innerWidth - 520) / project.pixelWidth,
            (window.innerHeight - 100) / project.pixelHeight
          ),
          panX: 0,
          panY: 0,
        }));
      } catch (err) {
        console.error('Failed to load project:', err);
        alert('Failed to load project file.');
      }
    };
    reader.readAsText(file);
  }, []);

  const setBlockChoice = useCallback((colourSetId: number, blockIndex: number) => {
    setState(prev => {
      if (!prev.project) return prev;
      return {
        ...prev,
        project: {
          ...prev.project,
          blockChoices: { ...prev.project.blockChoices, [colourSetId]: blockIndex },
        },
      };
    });
  }, []);

  return {
    state,
    setState,
    setTool,
    setBrushSize,
    setSelectedColour,
    setZoom,
    setPan,
    setCursor,
    toggleGrid,
    toggleMapBorders,
    setColoursData,
    rebuildPalette,
    openImportDialog,
    closeImportDialog,
    setSourceImage,
    createProject,
    setPixel,
    setPixelsBatch,
    commitPixels,
    fillArea,
    undo,
    redo,
    setSelection,
    copySelection,
    pasteClipboard,
    deleteSelection,
    openExportDialog,
    closeExportDialog,
    doExport,
    saveProject,
    loadProject,
    setBlockChoice,
  };
}

function downloadFile(filename: string, data: Uint8Array) {
  const blob = new Blob([data as unknown as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
