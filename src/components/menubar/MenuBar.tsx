// Top menu bar

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface MenuBarProps {
  hasProject: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasLastExport: boolean;
  onNewProject: () => void;
  onNewBlankProject: () => void;
  onOpenImage: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onExport: () => void;
  onQuickExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  onToggleGrid: () => void;
  onToggleMapBorders: () => void;
  onToggleSplitView: () => void;
  onToggleDiffOverlay: () => void;
  onToggleDualView: () => void;
  onOpenPreferences: () => void;
  showGrid: boolean;
  showMapBorders: boolean;
  splitViewMode: boolean;
  showDiffOverlay: boolean;
  dualViewMode: boolean;
  hasSourceImage: boolean;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  hasProject, canUndo, canRedo, hasLastExport,
  onNewProject, onNewBlankProject, onOpenImage, onSaveProject, onLoadProject,
  onExport, onQuickExport, onUndo, onRedo, onZoomIn, onZoomOut, onFitToWindow,
  onToggleGrid, onToggleMapBorders, onToggleSplitView, onToggleDiffOverlay,
  onToggleDualView, onOpenPreferences, showGrid, showMapBorders, splitViewMode,
  showDiffOverlay, dualViewMode, hasSourceImage,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New Project...', action: onNewBlankProject },
      { label: 'Open Image...', shortcut: 'Ctrl+O', action: onOpenImage },
      { label: 'separator', separator: true },
      { label: 'Save Project', shortcut: 'Ctrl+S', action: onSaveProject, disabled: !hasProject },
      { label: 'Load Project...', action: onLoadProject },
      { label: 'separator2', separator: true },
      { label: 'Export...', shortcut: 'Ctrl+E', action: onExport, disabled: !hasProject },
      { label: 'Quick Export', shortcut: 'Ctrl+Shift+E', action: onQuickExport, disabled: !hasProject || !hasLastExport },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo, disabled: !canUndo },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: onRedo, disabled: !canRedo },
    ],
    View: [
      { label: 'Zoom In', shortcut: '+', action: onZoomIn },
      { label: 'Zoom Out', shortcut: '-', action: onZoomOut },
      { label: 'Fit to Window', shortcut: 'Ctrl+0', action: onFitToWindow },
      { label: 'separator', separator: true },
      { label: 'Show Grid', action: onToggleGrid, checked: showGrid },
      { label: 'Show Map Borders', action: onToggleMapBorders, checked: showMapBorders },
      { label: 'separator2', separator: true },
      { label: 'Split View', action: onToggleSplitView, checked: splitViewMode, disabled: !hasSourceImage },
      { label: 'Dual Map View', action: onToggleDualView, checked: dualViewMode, disabled: !hasSourceImage },
      { label: 'Show Differences', shortcut: 'D', action: onToggleDiffOverlay, checked: showDiffOverlay, disabled: !hasSourceImage },
    ],
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openMenu]);

  const handleMenuClick = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled || item.separator) return;
    item.action?.();
    setOpenMenu(null);
  };

  return (
    <div className="menu-bar" ref={menuRef}>
      <span className="menu-brand">MapArt Studio</span>
      {Object.entries(menus).map(([name, items]) => (
        <div
          key={name}
          className="menu-item"
          onClick={() => handleMenuClick(name)}
          onMouseEnter={() => openMenu && setOpenMenu(name)}
        >
          {name}
          {openMenu === name && (
            <div className="menu-dropdown">
              {items.map((item, i) => (
                item.separator ? (
                  <div key={item.label} className="menu-separator" />
                ) : (
                  <div
                    key={item.label}
                    className="menu-dropdown-item"
                    style={{ opacity: item.disabled ? 0.4 : 1 }}
                    onClick={() => handleItemClick(item)}
                  >
                    <span>
                      {item.checked !== undefined && (
                        <span style={{ marginRight: 6 }}>{item.checked ? '\u2713' : '\u00A0\u00A0'}</span>
                      )}
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <span className="menu-shortcut">{item.shortcut}</span>
                    )}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <button className="menu-prefs-btn" onClick={onOpenPreferences} title="Preferences">
        {'\u2699'}
      </button>
    </div>
  );
};
