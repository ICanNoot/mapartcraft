// Central application state management

import { useState, useCallback, useRef } from 'react';
import {
  ProjectState, ToolType, ConversionSettings, SelectionRect,
  HistoryEntry, EMPTY_PIXEL, MAP_SIZE, DEFAULT_CONVERSION_SETTINGS,
  encodePixel, decodePixel, ToneVariant, ExportSettings, RecentProject,
} from '../types';
import { buildPalette, findNearestColour, findCarpetBlockIndex } from '../utils/colour';
import { PaletteEntry } from '../types';
import { applyDithering } from '../utils/dither';
import { resizeImage, applyPreprocessing, calculateDefaultMapSize } from '../utils/imageProcessing';
import { exportProject, exportMapDat, bundleAsZip } from '../utils/export';

const MAX_HISTORY = 100;
const RECENT_PROJECTS_KEY = 'mapart_recent_projects';

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
  exportDialogOpen: boolean;
  rightSidebarTab: 'palette' | 'settings' | 'materials';
  recentProjects: RecentProject[];
}

function loadRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveRecentProjects(projects: RecentProject[]) {
  try {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects.slice(0, 10)));
  } catch { /* ignore */ }
}

function addRecentProject(name: string, mapWidth: number, mapHeight: number, thumbnail: string): RecentProject[] {
  const existing = loadRecentProjects();
  const entry: RecentProject = {
    name,
    date: new Date().toISOString(),
    mapWidth,
    mapHeight,
    thumbnail,
  };
  // Remove duplicate by name
  const filtered = existing.filter(p => p.name !== name);
  const updated = [entry, ...filtered].slice(0, 10);
  saveRecentProjects(updated);
  return updated;
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
    exportDialogOpen: false,
    rightSidebarTab: 'palette',
    recentProjects: loadRecentProjects(),
  });

  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const reconvertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushHistory = useCallback((pixels: Uint16Array, description: string) => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    history.splice(idx + 1);
    history.push({ pixels: new Uint16Array(pixels), description });
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
        return { ...prev, project: { ...prev.project, pixels: new Uint16Array(entry.pixels) } };
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
        return { ...prev, project: { ...prev.project, pixels: new Uint16Array(entry.pixels) } };
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
      const disabled = prev.project?.disabledColourSets;
      const palette = buildPalette(prev.coloursData, cs.mapMode, cs.carpetOnly, cs.betterColour, disabled);
      return { ...prev, palette };
    });
  }, []);

  const setRightSidebarTab = useCallback((tab: 'palette' | 'settings' | 'materials') => {
    setState(prev => ({ ...prev, rightSidebarTab: tab }));
  }, []);

  // Run conversion pipeline on sourceImageData with given settings
  const runConversion = useCallback((
    sourceImageData: ImageData,
    pixelWidth: number,
    pixelHeight: number,
    settings: ConversionSettings,
    coloursData: Record<string, any>,
    disabledColourSets?: number[],
  ): Uint16Array => {
    const pixels = new Uint16Array(pixelWidth * pixelHeight).fill(EMPTY_PIXEL);

    const cloned = new ImageData(
      new Uint8ClampedArray(sourceImageData.data),
      sourceImageData.width,
      sourceImageData.height
    );

    const processed = applyPreprocessing(
      cloned,
      settings.brightness,
      settings.contrast,
      settings.saturation
    );

    const palette = buildPalette(coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour, disabledColourSets);

    const result = applyDithering(
      processed.data,
      pixelWidth,
      pixelHeight,
      palette,
      settings.ditherMethod,
      settings.betterColour,
      settings.transparencyEnabled,
      settings.transparencyThreshold
    );

    for (let i = 0; i < result.length; i++) {
      pixels[i] = encodePixel(result[i].colourSetId, result[i].tone as ToneVariant);
    }

    return pixels;
  }, []);

  // Import an image directly — auto-sizes, converts with current settings
  const importImage = useCallback((img: HTMLImageElement) => {
    setState(prev => {
      if (!prev.coloursData) return prev;
      const coloursData = prev.coloursData;
      const settings = prev.project?.conversionSettings ?? DEFAULT_CONVERSION_SETTINGS;
      const disabled = prev.project?.disabledColourSets ?? [];

      const { mapWidth, mapHeight } = calculateDefaultMapSize(img.width, img.height);
      const pixelWidth = mapWidth * MAP_SIZE;
      const pixelHeight = mapHeight * MAP_SIZE;

      const sourceImageData = resizeImage(img, pixelWidth, pixelHeight, settings.resizeAlgorithm);

      const origCanvas = document.createElement('canvas');
      origCanvas.width = img.width;
      origCanvas.height = img.height;
      origCanvas.getContext('2d')!.drawImage(img, 0, 0);
      const originalImageData = origCanvas.getContext('2d')!.getImageData(0, 0, img.width, img.height);

      const pixels = runConversion(sourceImageData, pixelWidth, pixelHeight, settings, coloursData, disabled);
      const palette = buildPalette(coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour, disabled);

      const project: ProjectState = {
        mapWidth, mapHeight, pixelWidth, pixelHeight, pixels,
        blockChoices: prev.project?.blockChoices ?? {},
        disabledColourSets: disabled,
        conversionSettings: settings,
        sourceImageData, originalImageData,
      };

      historyRef.current = [{ pixels: new Uint16Array(pixels), description: 'Initial' }];
      historyIndexRef.current = 0;

      return {
        ...prev, project, palette,
        zoom: Math.min(
          (window.innerWidth - 520) / pixelWidth,
          (window.innerHeight - 100) / pixelHeight
        ),
        panX: 0, panY: 0,
      };
    });
  }, [runConversion]);

  const createProject = useCallback((
    mapWidth: number, mapHeight: number,
    sourceImageData: ImageData | null, originalImageData: ImageData | null,
    settings: ConversionSettings, coloursData: Record<string, any>
  ) => {
    const pixelWidth = mapWidth * MAP_SIZE;
    const pixelHeight = mapHeight * MAP_SIZE;
    let pixels: Uint16Array;

    if (sourceImageData) {
      pixels = runConversion(sourceImageData, pixelWidth, pixelHeight, settings, coloursData);
    } else {
      pixels = new Uint16Array(pixelWidth * pixelHeight).fill(EMPTY_PIXEL);
    }

    const palette = buildPalette(coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour);

    const project: ProjectState = {
      mapWidth, mapHeight, pixelWidth, pixelHeight, pixels,
      blockChoices: {},
      disabledColourSets: [],
      conversionSettings: settings,
      sourceImageData, originalImageData,
    };

    historyRef.current = [{ pixels: new Uint16Array(pixels), description: 'Initial' }];
    historyIndexRef.current = 0;

    setState(prev => ({
      ...prev, project, palette,
      zoom: Math.min(
        (window.innerWidth - 520) / pixelWidth,
        (window.innerHeight - 100) / pixelHeight
      ),
      panX: 0, panY: 0,
    }));
  }, [runConversion]);

  const reconvert = useCallback((description: string) => {
    setState(prev => {
      const srcImg = prev.project?.sourceImageData;
      if (!prev.project || !srcImg || !prev.coloursData) return prev;
      const settings = prev.project.conversionSettings;
      const disabled = prev.project.disabledColourSets;

      const pixels = runConversion(srcImg, prev.project.pixelWidth, prev.project.pixelHeight, settings, prev.coloursData, disabled);
      pushHistory(pixels, description);

      const palette = buildPalette(prev.coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour, disabled);
      return { ...prev, project: { ...prev.project, pixels }, palette };
    });
  }, [runConversion, pushHistory]);

  const resizeAndReconvert = useCallback((newMapWidth: number, newMapHeight: number) => {
    setState(prev => {
      if (!prev.project || !prev.coloursData) return prev;
      const { project, coloursData } = prev;
      const origImg = project.originalImageData;
      if (!origImg) return prev;

      const newPixelWidth = newMapWidth * MAP_SIZE;
      const newPixelHeight = newMapHeight * MAP_SIZE;

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = origImg.width;
      tmpCanvas.height = origImg.height;
      tmpCanvas.getContext('2d')!.putImageData(origImg, 0, 0);

      const newSourceImageData = resizeImage(tmpCanvas, newPixelWidth, newPixelHeight, project.conversionSettings.resizeAlgorithm);
      const settings = project.conversionSettings;
      const disabled = project.disabledColourSets;
      const pixels = runConversion(newSourceImageData, newPixelWidth, newPixelHeight, settings, coloursData, disabled);
      const palette = buildPalette(coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour, disabled);

      pushHistory(pixels, `Resize to ${newMapWidth}x${newMapHeight}`);

      return {
        ...prev,
        project: {
          ...project,
          mapWidth: newMapWidth, mapHeight: newMapHeight,
          pixelWidth: newPixelWidth, pixelHeight: newPixelHeight,
          pixels, sourceImageData: newSourceImageData,
        },
        palette,
      };
    });
  }, [runConversion, pushHistory]);

  const updateConversionSetting = useCallback(<K extends keyof ConversionSettings>(
    key: K, value: ConversionSettings[K], debounce?: boolean
  ) => {
    setState(prev => {
      if (!prev.project) return prev;
      return {
        ...prev,
        project: {
          ...prev.project,
          conversionSettings: { ...prev.project.conversionSettings, [key]: value },
        },
      };
    });

    if (reconvertTimerRef.current) {
      clearTimeout(reconvertTimerRef.current);
      reconvertTimerRef.current = null;
    }

    const doReconvert = () => {
      setState(prev => {
        if (!prev.project || !prev.coloursData) return prev;
        const disabled = prev.project.disabledColourSets;

        if (key === 'resizeAlgorithm' && prev.project.originalImageData) {
          const origImg = prev.project.originalImageData;
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = origImg.width;
          tmpCanvas.height = origImg.height;
          tmpCanvas.getContext('2d')!.putImageData(origImg, 0, 0);
          const newSourceImageData = resizeImage(
            tmpCanvas, prev.project.pixelWidth, prev.project.pixelHeight,
            prev.project.conversionSettings.resizeAlgorithm
          );
          const settings = prev.project.conversionSettings;
          const pixels = runConversion(newSourceImageData, prev.project.pixelWidth, prev.project.pixelHeight, settings, prev.coloursData, disabled);
          pushHistory(pixels, `Changed resize algorithm to ${value}`);
          const palette = buildPalette(prev.coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour, disabled);
          return { ...prev, project: { ...prev.project, pixels, sourceImageData: newSourceImageData }, palette };
        }

        if (!prev.project.sourceImageData) return prev;
        const settings = prev.project.conversionSettings;
        const pixels = runConversion(
          prev.project.sourceImageData, prev.project.pixelWidth, prev.project.pixelHeight,
          settings, prev.coloursData, disabled
        );
        pushHistory(pixels, `Changed ${key} to ${value}`);
        const palette = buildPalette(prev.coloursData, settings.mapMode, settings.carpetOnly, settings.betterColour, disabled);
        return { ...prev, project: { ...prev.project, pixels }, palette };
      });
    };

    if (debounce) {
      reconvertTimerRef.current = setTimeout(doReconvert, 350);
    } else {
      reconvertTimerRef.current = setTimeout(doReconvert, 10);
    }
  }, [runConversion, pushHistory]);

  // Toggle a colour set enabled/disabled — remap existing pixels if disabling
  const toggleColourSet = useCallback((colourSetId: number) => {
    setState(prev => {
      if (!prev.project || !prev.coloursData) return prev;
      const { project, coloursData } = prev;
      const disabled = [...project.disabledColourSets];
      const idx = disabled.indexOf(colourSetId);

      if (idx >= 0) {
        // Re-enable
        disabled.splice(idx, 1);
        const palette = buildPalette(coloursData, project.conversionSettings.mapMode, project.conversionSettings.carpetOnly, project.conversionSettings.betterColour, disabled);
        return { ...prev, project: { ...project, disabledColourSets: disabled }, palette };
      } else {
        // Disable — remap existing pixels using this colour set to nearest enabled colour
        disabled.push(colourSetId);
        const palette = buildPalette(coloursData, project.conversionSettings.mapMode, project.conversionSettings.carpetOnly, true, disabled);

        if (palette.length === 0) {
          return { ...prev, project: { ...project, disabledColourSets: disabled }, palette };
        }

        const newPixels = new Uint16Array(project.pixels);
        for (let i = 0; i < newPixels.length; i++) {
          const decoded = decodePixel(newPixels[i]);
          if (decoded && decoded.colourSetId === colourSetId) {
            const cs = coloursData[decoded.colourSetId.toString()];
            if (cs) {
              const rgb = cs.tonesRGB[decoded.tone] as [number, number, number];
              if (rgb) {
                const nearest = findNearestColour(rgb[0], rgb[1], rgb[2], palette, project.conversionSettings.betterColour);
                newPixels[i] = encodePixel(nearest.entry.colourSetId, nearest.entry.tone);
              }
            }
          }
        }

        pushHistory(newPixels, `Disabled colour set ${colourSetId}`);
        const displayPalette = buildPalette(coloursData, project.conversionSettings.mapMode, project.conversionSettings.carpetOnly, project.conversionSettings.betterColour, disabled);
        return { ...prev, project: { ...project, pixels: newPixels, disabledColourSets: disabled }, palette: displayPalette };
      }
    });
  }, [pushHistory]);

  const enableAllColourSets = useCallback(() => {
    setState(prev => {
      if (!prev.project || !prev.coloursData) return prev;
      const palette = buildPalette(prev.coloursData, prev.project.conversionSettings.mapMode, prev.project.conversionSettings.carpetOnly, prev.project.conversionSettings.betterColour);
      return { ...prev, project: { ...prev.project, disabledColourSets: [] }, palette };
    });
  }, []);

  const disableAllColourSets = useCallback(() => {
    setState(prev => {
      if (!prev.project || !prev.coloursData) return prev;
      const allIds = Object.keys(prev.coloursData).map(Number);
      return { ...prev, project: { ...prev.project, disabledColourSets: allIds }, palette: [] };
    });
  }, []);

  const setPixel = useCallback((x: number, y: number, colourSetId: number, tone: ToneVariant) => {
    setState(prev => {
      if (!prev.project) return prev;
      if (x < 0 || x >= prev.project.pixelWidth || y < 0 || y >= prev.project.pixelHeight) return prev;
      const newPixels = new Uint16Array(prev.project.pixels);
      newPixels[y * prev.project.pixelWidth + x] = encodePixel(colourSetId, tone);
      return { ...prev, project: { ...prev.project, pixels: newPixels } };
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
      return { ...prev, project: { ...prev.project, pixels: newPixels } };
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
      return { ...prev, project: { ...prev.project, pixels: newPixels } };
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
      return { ...prev, project: { ...prev.project, pixels: newPixels } };
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
      return { ...prev, project: { ...prev.project, pixels: newPixels }, selection: null };
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

    let files: { filename: string; data: Uint8Array }[];

    if (settings.exportFormat === 'mapdat') {
      files = await exportMapDat(currentState.project, currentState.coloursData, settings);
    } else {
      files = await exportProject(currentState.project, currentState.coloursData, settings);
    }

    if (files.length === 1) {
      downloadFile(files[0].filename, files[0].data);
    } else {
      const zipData = await bundleAsZip(files);
      downloadFile(`${settings.filename}.zip`, zipData);
    }
  }, [state]);

  const saveProject = useCallback(() => {
    if (!state.project) return;
    let sourceImageSerialized: { width: number; height: number; data: number[] } | null = null;
    if (state.project.sourceImageData) {
      const sid = state.project.sourceImageData;
      sourceImageSerialized = {
        width: sid.width, height: sid.height,
        data: Array.from(sid.data),
      };
    }
    const data = {
      version: 3,
      mapWidth: state.project.mapWidth,
      mapHeight: state.project.mapHeight,
      pixelWidth: state.project.pixelWidth,
      pixelHeight: state.project.pixelHeight,
      pixels: Array.from(state.project.pixels),
      blockChoices: state.project.blockChoices,
      disabledColourSets: state.project.disabledColourSets,
      conversionSettings: state.project.conversionSettings,
      sourceImageData: sourceImageSerialized,
    };
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.mapstudio';
    a.click();
    URL.revokeObjectURL(url);

    // Generate thumbnail and save to recent projects
    const thumbnail = generateThumbnail(state.project, state.coloursData);
    const recentProjects = addRecentProject('project', state.project.mapWidth, state.project.mapHeight, thumbnail);
    setState(prev => ({ ...prev, recentProjects }));
  }, [state.project, state.coloursData]);

  const loadProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const pixels = new Uint16Array(data.pixels);

        let sourceImageData: ImageData | null = null;
        if (data.sourceImageData) {
          const sid = data.sourceImageData;
          sourceImageData = new ImageData(
            new Uint8ClampedArray(sid.data), sid.width, sid.height
          );
        }

        const project: ProjectState = {
          mapWidth: data.mapWidth,
          mapHeight: data.mapHeight,
          pixelWidth: data.pixelWidth,
          pixelHeight: data.pixelHeight,
          pixels,
          blockChoices: data.blockChoices || {},
          disabledColourSets: data.disabledColourSets || [],
          conversionSettings: data.conversionSettings || DEFAULT_CONVERSION_SETTINGS,
          sourceImageData,
          originalImageData: null,
        };

        historyRef.current = [{ pixels: new Uint16Array(pixels), description: 'Loaded' }];
        historyIndexRef.current = 0;

        // Add to recent projects
        const name = file.name.replace('.mapstudio', '');
        setState(prev => {
          const thumbnail = generateThumbnail(project, prev.coloursData);
          const recentProjects = addRecentProject(name, project.mapWidth, project.mapHeight, thumbnail);
          return {
            ...prev, project, recentProjects,
            zoom: Math.min(
              (window.innerWidth - 520) / project.pixelWidth,
              (window.innerHeight - 100) / project.pixelHeight
            ),
            panX: 0, panY: 0,
          };
        });
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

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return {
    state, setState,
    setTool, setBrushSize, setSelectedColour,
    setZoom, setPan, setCursor,
    toggleGrid, toggleMapBorders,
    setColoursData, rebuildPalette, setRightSidebarTab,
    importImage, createProject,
    reconvert, resizeAndReconvert, updateConversionSetting,
    setPixel, setPixelsBatch, commitPixels, fillArea,
    undo, redo, canUndo, canRedo,
    setSelection, copySelection, pasteClipboard, deleteSelection,
    openExportDialog, closeExportDialog, doExport,
    saveProject, loadProject, setBlockChoice,
    toggleColourSet, enableAllColourSets, disableAllColourSets,
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

function generateThumbnail(project: ProjectState, coloursData: Record<string, any> | null): string {
  if (!coloursData) return '';
  try {
    const thumbSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = thumbSize;
    canvas.height = thumbSize;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(thumbSize, thumbSize);
    const scaleX = project.pixelWidth / thumbSize;
    const scaleY = project.pixelHeight / thumbSize;

    for (let ty = 0; ty < thumbSize; ty++) {
      for (let tx = 0; tx < thumbSize; tx++) {
        const px = Math.floor(tx * scaleX);
        const py = Math.floor(ty * scaleY);
        const encoded = project.pixels[py * project.pixelWidth + px];
        const decoded = decodePixel(encoded);
        const idx = (ty * thumbSize + tx) * 4;
        if (decoded) {
          const cs = coloursData[decoded.colourSetId.toString()];
          if (cs?.tonesRGB?.[decoded.tone]) {
            const [r, g, b] = cs.tonesRGB[decoded.tone];
            imageData.data[idx] = r;
            imageData.data[idx + 1] = g;
            imageData.data[idx + 2] = b;
            imageData.data[idx + 3] = 255;
            continue;
          }
        }
        imageData.data[idx] = 30;
        imageData.data[idx + 1] = 30;
        imageData.data[idx + 2] = 50;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}
