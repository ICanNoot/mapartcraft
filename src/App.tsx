// MapArt Studio — Main Application Component

import React, { useEffect, useCallback, useRef } from 'react';
import { useAppState } from './hooks/useAppState';
import { MenuBar } from './components/menubar/MenuBar';
import { ToolPanel } from './components/tools/ToolPanel';
import { PixelCanvas } from './components/canvas/PixelCanvas';
import { PalettePanel } from './components/palette/PalettePanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { StatusBar } from './components/statusbar/StatusBar';
import { ImportDialog } from './components/dialogs/ImportDialog';
import { ExportDialog } from './components/dialogs/ExportDialog';
import { loadImage } from './utils/imageProcessing';
import { ToolType, ToneVariant, ResizeAlgorithm, MAP_SIZE } from './types';

// Import colour data - will be bundled by Vite
import coloursJSON from './data/coloursJSON.json';

const App: React.FC = () => {
  const {
    state, setTool, setBrushSize, setSelectedColour,
    setZoom, setPan, setCursor, toggleGrid, toggleMapBorders,
    setColoursData, rebuildPalette, setRightSidebarTab,
    openImportDialog, closeImportDialog, setSourceImage,
    createProject, reconvert, resizeAndReconvert, updateConversionSetting,
    setPixelsBatch, commitPixels, fillArea,
    undo, redo, canUndo, canRedo,
    setSelection, copySelection, pasteClipboard,
    deleteSelection, openExportDialog, closeExportDialog,
    doExport, saveProject, loadProject,
  } = useAppState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Load colour data on mount
  useEffect(() => {
    setColoursData(coloursJSON as Record<string, any>);
  }, [setColoursData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b': setTool('pencil'); return;
          case 'e': setTool('eraser'); return;
          case 'i': setTool('eyedropper'); return;
          case 'g': setTool('fill'); return;
          case 'm': setTool('selection'); return;
        }
      }

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            return;
          case 'c':
            if (state.selection) { e.preventDefault(); copySelection(); }
            return;
          case 'v':
            if (state.clipboard) {
              e.preventDefault();
              const x = state.selection?.x ?? 0;
              const y = state.selection?.y ?? 0;
              pasteClipboard(x, y);
            }
            return;
          case 's':
            e.preventDefault();
            saveProject();
            return;
          case 'e':
            e.preventDefault();
            if (state.project) openExportDialog();
            return;
          case 'o':
            e.preventDefault();
            fileInputRef.current?.click();
            return;
          case '0':
            e.preventDefault();
            fitToWindow();
            return;
        }
      }

      // Zoom
      if (e.key === '=' || e.key === '+') {
        setZoom(state.zoom * 1.25);
      }
      if (e.key === '-') {
        setZoom(state.zoom / 1.25);
      }

      // Delete selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selection) {
          e.preventDefault();
          deleteSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.zoom, state.selection, state.clipboard, state.project, setTool, undo, redo, copySelection, pasteClipboard, deleteSelection, saveProject, openExportDialog, setZoom]);

  const fitToWindow = useCallback(() => {
    if (!state.project) return;
    const availW = window.innerWidth - 520; // sidebars
    const availH = window.innerHeight - 80; // menu + status
    const z = Math.min(availW / state.project.pixelWidth, availH / state.project.pixelHeight);
    setZoom(z);
    setPan(0, 0);
  }, [state.project, setZoom, setPan]);

  // File input handlers
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be selected again

    if (file.name.endsWith('.mapstudio')) {
      loadProject(file);
      return;
    }

    try {
      const img = await loadImage(file);
      setSourceImage(img);
      openImportDialog();
    } catch (err) {
      console.error('Failed to load image:', err);
      alert('Failed to load image file.');
    }
  }, [setSourceImage, openImportDialog, loadProject]);

  const handleProjectFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    loadProject(file);
  }, [loadProject]);

  const handleImport = useCallback((
    mapWidth: number,
    mapHeight: number,
    sourceImageData: ImageData,
    originalImageData: ImageData,
    resizeAlgorithm: ResizeAlgorithm,
  ) => {
    if (!state.coloursData) return;
    const settings = state.project?.conversionSettings ?? {
      mapMode: 'flat' as const,
      staircaseMode: 'classic' as const,
      ditherMethod: 'none' as const,
      resizeAlgorithm,
      betterColour: false,
      carpetOnly: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
    };
    createProject(mapWidth, mapHeight, sourceImageData, originalImageData, { ...settings, resizeAlgorithm }, state.coloursData);
  }, [state.coloursData, state.project?.conversionSettings, createProject]);

  const handleEyedrop = useCallback((colourSetId: number, tone: ToneVariant) => {
    setSelectedColour(colourSetId, tone);
    setTool('pencil');
  }, [setSelectedColour, setTool]);

  const handleFilterChange = useCallback((carpetOnly: boolean) => {
    rebuildPalette({ carpetOnly });
  }, [rebuildPalette]);

  const handleMapSizeChange = useCallback((newMapWidth: number, newMapHeight: number) => {
    resizeAndReconvert(newMapWidth, newMapHeight);
  }, [resizeAndReconvert]);

  return (
    <div className="app-container">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.mapstudio"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".mapstudio"
        style={{ display: 'none' }}
        onChange={handleProjectFileSelect}
      />

      {/* Menu Bar */}
      <MenuBar
        hasProject={!!state.project}
        canUndo={canUndo}
        canRedo={canRedo}
        onNewProject={() => fileInputRef.current?.click()}
        onOpenImage={() => fileInputRef.current?.click()}
        onSaveProject={saveProject}
        onLoadProject={() => projectInputRef.current?.click()}
        onExport={openExportDialog}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={() => setZoom(state.zoom * 1.25)}
        onZoomOut={() => setZoom(state.zoom / 1.25)}
        onFitToWindow={fitToWindow}
        onToggleGrid={toggleGrid}
        onToggleMapBorders={toggleMapBorders}
        showGrid={state.showGrid}
        showMapBorders={state.showMapBorders}
      />

      {/* Main content */}
      <div className="app-main">
        {/* Left sidebar */}
        <ToolPanel
          activeTool={state.activeTool}
          brushSize={state.brushSize}
          selectedColourSetId={state.selectedColourSetId}
          selectedTone={state.selectedTone}
          coloursData={state.coloursData}
          onToolChange={setTool}
          onBrushSizeChange={setBrushSize}
        />

        {/* Centre — Canvas */}
        {state.project ? (
          <PixelCanvas
            project={state.project}
            coloursData={state.coloursData!}
            zoom={state.zoom}
            panX={state.panX}
            panY={state.panY}
            showGrid={state.showGrid}
            showMapBorders={state.showMapBorders}
            activeTool={state.activeTool}
            brushSize={state.brushSize}
            selectedColourSetId={state.selectedColourSetId}
            selectedTone={state.selectedTone}
            selection={state.selection}
            onZoomChange={setZoom}
            onPanChange={setPan}
            onCursorChange={setCursor}
            onPixelsBatch={setPixelsBatch}
            onCommitPixels={commitPixels}
            onFill={fillArea}
            onEyedrop={handleEyedrop}
            onSelectionChange={setSelection}
          />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-title">MapArt Studio</div>
            <div className="welcome-subtitle">
              Minecraft map art editor with pixel-level control.
              Import an image to get started, or load an existing project.
            </div>
            <div className="welcome-actions">
              <button
                className="welcome-btn primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Open Image
              </button>
              <button
                className="welcome-btn"
                onClick={() => projectInputRef.current?.click()}
              >
                Load Project
              </button>
            </div>
          </div>
        )}

        {/* Right sidebar — tabbed */}
        <div className="right-sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${state.rightSidebarTab === 'palette' ? 'active' : ''}`}
              onClick={() => setRightSidebarTab('palette')}
            >
              Palette
            </button>
            <button
              className={`sidebar-tab ${state.rightSidebarTab === 'settings' ? 'active' : ''}`}
              onClick={() => setRightSidebarTab('settings')}
            >
              Settings
            </button>
          </div>

          {state.rightSidebarTab === 'palette' ? (
            <PalettePanel
              palette={state.palette}
              coloursData={state.coloursData}
              selectedColourSetId={state.selectedColourSetId}
              selectedTone={state.selectedTone}
              mapMode={state.project?.conversionSettings.mapMode ?? 'flat'}
              carpetOnly={state.project?.conversionSettings.carpetOnly ?? false}
              onSelectColour={setSelectedColour}
              onFilterChange={handleFilterChange}
            />
          ) : (
            <SettingsPanel
              settings={state.project?.conversionSettings ?? {
                mapMode: 'flat',
                staircaseMode: 'classic',
                ditherMethod: 'none',
                resizeAlgorithm: 'bilinear',
                betterColour: false,
                carpetOnly: false,
                brightness: 0,
                contrast: 0,
                saturation: 0,
              }}
              hasSourceImage={!!state.project?.sourceImageData}
              mapWidth={state.project?.mapWidth ?? 1}
              mapHeight={state.project?.mapHeight ?? 1}
              onSettingChange={updateConversionSetting}
              onMapSizeChange={handleMapSizeChange}
            />
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        project={state.project}
        cursorX={state.cursorX}
        cursorY={state.cursorY}
        zoom={state.zoom}
      />

      {/* Dialogs */}
      {state.importDialogOpen && state.coloursData && (
        <ImportDialog
          sourceImage={state.sourceImage}
          onImport={handleImport}
          onClose={closeImportDialog}
        />
      )}

      {state.exportDialogOpen && state.project && (
        <ExportDialog
          project={state.project}
          onExport={(settings) => {
            doExport(settings);
            closeExportDialog();
          }}
          onClose={closeExportDialog}
        />
      )}
    </div>
  );
};

export default App;
