// MapArt Studio — Main Application Component

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useAppState } from './hooks/useAppState';
import { MenuBar } from './components/menubar/MenuBar';
import { ToolRail } from './components/toolbar/ToolRail';
import { PixelCanvas } from './components/canvas/PixelCanvas';
import { FloatingColourBox } from './components/canvas/FloatingColourBox';
import { Minimap } from './components/canvas/Minimap';
import { PopupPalette } from './components/canvas/PopupPalette';
import { DualViewCanvas } from './components/canvas/DualViewCanvas';
import { DualViewBar } from './components/canvas/DualViewBar';
import { PalettePanel } from './components/palette/PalettePanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { MaterialsPanel } from './components/materials/MaterialsPanel';
import { BlockInfoDrawer } from './components/drawers/BlockInfoDrawer';
import { Drawer } from './components/drawers/Drawer';
import { StatusBar } from './components/statusbar/StatusBar';
import { ToastContainer } from './components/toast/ToastContainer';
import { ExportDialog } from './components/dialogs/ExportDialog';
import { NewProjectDialog } from './components/dialogs/NewProjectDialog';
import { PreferencesDialog } from './components/dialogs/PreferencesDialog';
import { loadImage } from './utils/imageProcessing';
import { ToneVariant, DEFAULT_CONVERSION_SETTINGS } from './types';

import coloursJSON from './data/coloursJSON.json';

const App: React.FC = () => {
  const {
    state, setTool, setBrushSize, setSelectedColour,
    setZoom, setPan, setCursor, toggleGrid, toggleMapBorders,
    setColoursData, rebuildPalette,
    importImage, createProject, updateConversionSetting, resizeAndReconvert,
    setPixelsBatch, commitPixels, fillArea,
    undo, redo, canUndo, canRedo,
    setSelection, copySelection, pasteClipboard,
    deleteSelection, openExportDialog, closeExportDialog,
    doExport, saveProject, loadProject, setBlockChoice,
    toggleColourSet, enableAllColourSets, disableAllColourSets,
    addToast, dismissToast,
    updatePreference, setPreferencesOpen,
    setShowBeforeAfter, setSplitViewPosition,
    quickExport,
    setDualViewMode, updateDualViewSetting, applyDualViewSettings,
  } = useAppState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [popupPalette, setPopupPalette] = useState<{ x: number; y: number } | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 600 });

  // Track whether user manually collapsed palette (for auto-expand logic)
  const paletteManuallyCollapsed = useRef(false);
  const paletteAutoExpanded = useRef(false);

  // Load colour data on mount
  useEffect(() => {
    setColoursData(coloursJSON as Record<string, any>);
  }, [setColoursData]);

  // Track canvas area dimensions for minimap
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setCanvasDims({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      // Before/after hold key
      const holdKey = state.preferences.beforeAfterHoldKey;
      if ((holdKey === 'Tab' && e.key === 'Tab') ||
          (holdKey === 'Backslash' && e.key === '\\')) {
        if (state.project?.sourceImageData) {
          e.preventDefault();
          setShowBeforeAfter(true);
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'b': setTool('pencil'); return;
          case 'e': setTool('eraser'); return;
          case 'i': setTool('eyedropper'); return;
          case 'g': setTool('fill'); return;
          case 'm': setTool('selection'); return;
          case 'd':
            // Toggle difference overlay
            if (state.project?.sourceImageData) {
              updatePreference('showDifferenceOverlay', !state.preferences.showDifferenceOverlay);
            }
            return;
        }

        // Number keys 1-9, 0 for recent colours
        if (e.key >= '1' && e.key <= '9') {
          const idx = parseInt(e.key) - 1;
          if (idx < state.recentColours.length) {
            const rc = state.recentColours[idx];
            setSelectedColour(rc.colourSetId, rc.tone);
          }
          return;
        }
        if (e.key === '0' && state.recentColours.length >= 10) {
          const rc = state.recentColours[9];
          setSelectedColour(rc.colourSetId, rc.tone);
          return;
        }
      }

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
              pasteClipboard(state.selection?.x ?? 0, state.selection?.y ?? 0);
            }
            return;
          case 's':
            e.preventDefault();
            saveProject();
            return;
          case 'e':
            e.preventDefault();
            if (e.shiftKey) {
              // Quick export
              if (state.project) quickExport();
            } else {
              if (state.project) openExportDialog();
            }
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

      if (e.key === '=' || e.key === '+') setZoom(state.zoom * 1.25);
      if (e.key === '-') setZoom(state.zoom / 1.25);

      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection) {
        e.preventDefault();
        deleteSelection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const holdKey = state.preferences.beforeAfterHoldKey;
      if ((holdKey === 'Tab' && e.key === 'Tab') ||
          (holdKey === 'Backslash' && e.key === '\\')) {
        setShowBeforeAfter(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.zoom, state.selection, state.clipboard, state.project, state.recentColours,
      state.preferences, setTool, undo, redo, copySelection, pasteClipboard, deleteSelection,
      saveProject, openExportDialog, setZoom, setSelectedColour, setShowBeforeAfter,
      updatePreference, quickExport]);

  // Alt+scroll to cycle palette colours
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.altKey || state.palette.length === 0) return;
      if ((e.target as HTMLElement).closest('.canvas-container')) {
        e.preventDefault();
        const currentIdx = state.palette.findIndex(
          p => p.colourSetId === state.selectedColourSetId && p.tone === state.selectedTone
        );
        const delta = e.deltaY > 0 ? 1 : -1;
        const nextIdx = (currentIdx + delta + state.palette.length) % state.palette.length;
        const next = state.palette[nextIdx];
        setSelectedColour(next.colourSetId, next.tone);
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [state.palette, state.selectedColourSetId, state.selectedTone, setSelectedColour]);

  // Clipboard image paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (!blob) continue;
          try {
            const img = await loadImage(blob);
            importImage(img);
          } catch { /* ignore */ }
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [importImage]);

  // Auto-expand palette when switching to drawing tool
  useEffect(() => {
    if (!state.preferences.autoExpandPaletteWhenDrawing) return;
    if (!state.project) return;
    if (paletteManuallyCollapsed.current) return;
    if (paletteAutoExpanded.current) return;
    if (state.activeTool === 'pencil' || state.activeTool === 'fill') {
      paletteAutoExpanded.current = true;
    }
  }, [state.activeTool, state.project, state.preferences.autoExpandPaletteWhenDrawing]);

  const fitToWindow = useCallback(() => {
    if (!state.project) return;
    const availW = window.innerWidth - 350; // tool rail + right panel
    const availH = window.innerHeight - 100;
    const z = Math.min(availW / state.project.pixelWidth, availH / state.project.pixelHeight);
    setZoom(z);
    setPan(-(state.project.pixelWidth * z) / 2, -(state.project.pixelHeight * z) / 2);
  }, [state.project, setZoom, setPan]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.name.endsWith('.mapstudio')) {
      loadProject(file);
      return;
    }
    try {
      const img = await loadImage(file);
      importImage(img);
    } catch (err) {
      console.error('Failed to load image:', err);
      addToast('Failed to load image file', 'error');
    }
  }, [importImage, loadProject, addToast]);

  const handleProjectFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    loadProject(file);
  }, [loadProject]);

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.mapstudio')) {
      loadProject(file);
      return;
    }
    if (file.type.startsWith('image/')) {
      try {
        const img = await loadImage(file);
        importImage(img);
      } catch (err) {
        console.error('Failed to load dropped image:', err);
      }
    }
  }, [importImage, loadProject]);

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

  const handleNewBlankProject = useCallback((mapWidth: number, mapHeight: number) => {
    if (!state.coloursData) return;
    createProject(mapWidth, mapHeight, null, null, DEFAULT_CONVERSION_SETTINGS, state.coloursData);
    setShowNewProjectDialog(false);
  }, [state.coloursData, createProject]);

  // Right-click popup palette
  const handleCanvasContextMenu = useCallback((x: number, y: number) => {
    if (!state.preferences.rightClickPopupPalette || !state.project) return;
    setPopupPalette({ x, y });
  }, [state.preferences.rightClickPopupPalette, state.project]);

  const handlePopupColourSelect = useCallback((colourSetId: number, tone: ToneVariant) => {
    setSelectedColour(colourSetId, tone);
  }, [setSelectedColour]);

  // Palette swatch click on tool rail opens palette drawer
  const handleColourSwatchClick = useCallback(() => {
    // Just a hint — the drawer auto-expand handles this
    paletteManuallyCollapsed.current = false;
    paletteAutoExpanded.current = false;
  }, []);

  const hasProject = !!state.project;
  const shouldForceOpenPalette = hasProject && paletteAutoExpanded.current && !paletteManuallyCollapsed.current;

  return (
    <div
      className="app-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-text">Drop image or project file here</div>
        </div>
      )}

      <MenuBar
        hasProject={hasProject}
        canUndo={canUndo}
        canRedo={canRedo}
        hasLastExport={!!state.lastExportSettings}
        onNewProject={() => fileInputRef.current?.click()}
        onNewBlankProject={() => setShowNewProjectDialog(true)}
        onOpenImage={() => fileInputRef.current?.click()}
        onSaveProject={saveProject}
        onLoadProject={() => projectInputRef.current?.click()}
        onExport={openExportDialog}
        onQuickExport={quickExport}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={() => setZoom(state.zoom * 1.25)}
        onZoomOut={() => setZoom(state.zoom / 1.25)}
        onFitToWindow={fitToWindow}
        onToggleGrid={toggleGrid}
        onToggleMapBorders={toggleMapBorders}
        onToggleSplitView={() => updatePreference('splitViewMode', !state.preferences.splitViewMode)}
        onToggleDiffOverlay={() => updatePreference('showDifferenceOverlay', !state.preferences.showDifferenceOverlay)}
        onToggleDualView={() => setDualViewMode(!state.dualViewMode)}
        onOpenPreferences={() => setPreferencesOpen(true)}
        showGrid={state.showGrid}
        showMapBorders={state.showMapBorders}
        splitViewMode={state.preferences.splitViewMode}
        showDiffOverlay={state.preferences.showDifferenceOverlay}
        dualViewMode={state.dualViewMode}
        hasSourceImage={!!state.project?.sourceImageData}
      />

      <div className="app-main">
        {hasProject && (
          <ToolRail
            activeTool={state.activeTool}
            brushSize={state.brushSize}
            canUndo={canUndo}
            canRedo={canRedo}
            selectedColourSetId={state.selectedColourSetId}
            selectedTone={state.selectedTone}
            coloursData={state.coloursData}
            onToolChange={setTool}
            onBrushSizeChange={setBrushSize}
            onUndo={undo}
            onRedo={redo}
            onColourSwatchClick={handleColourSwatchClick}
          />
        )}

        {state.project ? (
          <div className={`canvas-area ${state.dualViewMode ? 'dual-view-active' : ''}`} ref={canvasAreaRef}>
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
              canvasBackground={state.project.conversionSettings.canvasBackground}
              customBackgroundColour={state.project.conversionSettings.customBackgroundColour}
              showBeforeAfter={state.showBeforeAfter}
              splitViewMode={state.preferences.splitViewMode}
              splitViewPosition={state.splitViewPosition}
              showDifferenceOverlay={state.preferences.showDifferenceOverlay}
              onZoomChange={setZoom}
              onPanChange={setPan}
              onCursorChange={setCursor}
              onPixelsBatch={setPixelsBatch}
              onCommitPixels={commitPixels}
              onFill={fillArea}
              onEyedrop={handleEyedrop}
              onSelectionChange={setSelection}
              onContextMenu={handleCanvasContextMenu}
              onSplitPositionChange={setSplitViewPosition}
            />

            {state.dualViewMode && state.dualViewPixels && (
              <div className="dual-view-right-pane">
                <DualViewBar
                  settings={state.dualViewSettings}
                  onSettingChange={updateDualViewSetting}
                  onApply={applyDualViewSettings}
                  onClose={() => setDualViewMode(false)}
                />
                <DualViewCanvas
                  project={state.project}
                  dualViewPixels={state.dualViewPixels}
                  coloursData={state.coloursData!}
                  zoom={state.zoom}
                  panX={state.panX}
                  panY={state.panY}
                  showGrid={state.showGrid}
                  showMapBorders={state.showMapBorders}
                />
              </div>
            )}

            {state.preferences.showMinimap && (
              <Minimap
                project={state.project}
                coloursData={state.coloursData!}
                zoom={state.zoom}
                panX={state.panX}
                panY={state.panY}
                canvasWidth={canvasDims.w}
                canvasHeight={canvasDims.h}
                selectedColourSetId={state.selectedColourSetId}
                selectedTone={state.selectedTone}
                onPanChange={setPan}
              />
            )}

            {state.preferences.showFloatingColourBox && (
              <FloatingColourBox
                selectedColourSetId={state.selectedColourSetId}
                selectedTone={state.selectedTone}
                coloursData={state.coloursData}
                blockChoices={state.project.blockChoices}
              />
            )}

            {popupPalette && (
              <PopupPalette
                x={popupPalette.x}
                y={popupPalette.y}
                palette={state.palette}
                coloursData={state.coloursData}
                recentColours={state.recentColours}
                selectedColourSetId={state.selectedColourSetId}
                selectedTone={state.selectedTone}
                disabledColourSets={state.project.disabledColourSets}
                onSelectColour={handlePopupColourSelect}
                onClose={() => setPopupPalette(null)}
              />
            )}
          </div>
        ) : (
          <div
            className="welcome-screen"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="welcome-title">MapArt Studio</div>
            <div className="welcome-subtitle">
              Minecraft map art, pixel by pixel.
            </div>

            <div
              className={`welcome-dropzone ${isDragOver ? 'drag-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon">{'\u{1F5BC}'}</div>
              <div className="dropzone-text">Drop an image here</div>
              <div className="dropzone-hint">or click to browse</div>
            </div>

            <div className="welcome-secondary">
              <button className="welcome-link" onClick={() => setShowNewProjectDialog(true)}>
                New blank canvas
              </button>
              <span className="welcome-dot">{'\u00B7'}</span>
              <button className="welcome-link" onClick={() => projectInputRef.current?.click()}>
                Load project
              </button>
            </div>

            {state.recentProjects.length > 0 && (
              <div className="recent-projects">
                <div className="recent-title">Recent Projects</div>
                <div className="recent-list">
                  {state.recentProjects.map((rp, i) => (
                    <div key={i} className="recent-item" onClick={() => projectInputRef.current?.click()}>
                      {rp.thumbnail ? (
                        <img className="recent-thumb" src={rp.thumbnail} alt="" />
                      ) : (
                        <div className="recent-thumb-placeholder" />
                      )}
                      <div className="recent-info">
                        <div className="recent-name">{rp.name}</div>
                        <div className="recent-meta">
                          {rp.mapWidth}x{rp.mapHeight} maps
                          {' \u2014 '}
                          {new Date(rp.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasProject && <div className="right-panel">
          <Drawer
            id="palette"
            title="Palette"
            defaultOpen={true}
            disabled={!hasProject}
            disabledHint="Load an image to enable"
            forceOpen={shouldForceOpenPalette}
            onManualCollapse={() => { paletteManuallyCollapsed.current = true; }}
          >
            <PalettePanel
              palette={state.palette}
              coloursData={state.coloursData}
              selectedColourSetId={state.selectedColourSetId}
              selectedTone={state.selectedTone}
              mapMode={state.project?.conversionSettings.mapMode ?? 'flat'}
              carpetOnly={state.project?.conversionSettings.carpetOnly ?? false}
              blockChoices={state.project?.blockChoices ?? {}}
              disabledColourSets={state.project?.disabledColourSets ?? []}
              onSelectColour={setSelectedColour}
              onFilterChange={handleFilterChange}
              onBlockChoiceChange={setBlockChoice}
              onToggleColourSet={toggleColourSet}
              onEnableAll={enableAllColourSets}
              onDisableAll={disableAllColourSets}
            />
          </Drawer>

          <Drawer
            id="settings"
            title="Settings"
            defaultOpen={true}
            disabled={!hasProject}
            disabledHint="Load an image to enable"
          >
            <SettingsPanel
              settings={state.project?.conversionSettings ?? DEFAULT_CONVERSION_SETTINGS}
              hasSourceImage={!!state.project?.sourceImageData}
              mapWidth={state.project?.mapWidth ?? 1}
              mapHeight={state.project?.mapHeight ?? 1}
              onSettingChange={updateConversionSetting}
              onMapSizeChange={handleMapSizeChange}
            />
          </Drawer>

          <Drawer id="materials" title="Materials" defaultOpen={false}
            disabled={!hasProject} disabledHint="Load an image to enable">
            <MaterialsPanel
              project={state.project}
              coloursData={state.coloursData}
            />
          </Drawer>

          <Drawer id="blockinfo" title="Block Info" defaultOpen={false}>
            <BlockInfoDrawer
              project={state.project}
              coloursData={state.coloursData}
              cursorX={state.cursorX}
              cursorY={state.cursorY}
              selectedColourSetId={state.selectedColourSetId}
              selectedTone={state.selectedTone}
              blockChoices={state.project?.blockChoices ?? {}}
            />
          </Drawer>
        </div>}
      </div>

      <StatusBar
        project={state.project}
        cursorX={state.cursorX}
        cursorY={state.cursorY}
        zoom={state.zoom}
      />

      <ToastContainer toasts={state.toasts} onDismiss={dismissToast} />

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

      {showNewProjectDialog && (
        <NewProjectDialog
          onConfirm={handleNewBlankProject}
          onClose={() => setShowNewProjectDialog(false)}
        />
      )}

      {state.preferencesOpen && (
        <PreferencesDialog
          preferences={state.preferences}
          onUpdate={updatePreference}
          onClose={() => setPreferencesOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
