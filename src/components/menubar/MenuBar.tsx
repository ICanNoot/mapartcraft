// Top menu bar

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface MenuBarProps {
  hasProject: boolean;
  onNewProject: () => void;
  onOpenImage: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWindow: () => void;
  onToggleGrid: () => void;
  onToggleMapBorders: () => void;
  showGrid: boolean;
  showMapBorders: boolean;
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
  hasProject, onNewProject, onOpenImage, onSaveProject, onLoadProject,
  onExport, onUndo, onRedo, onZoomIn, onZoomOut, onFitToWindow,
  onToggleGrid, onToggleMapBorders, showGrid, showMapBorders,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'Open Image...', shortcut: 'Ctrl+O', action: onOpenImage },
      { label: 'separator', separator: true },
      { label: 'Save Project', shortcut: 'Ctrl+S', action: onSaveProject, disabled: !hasProject },
      { label: 'Load Project...', action: onLoadProject },
      { label: 'separator2', separator: true },
      { label: 'Export NBT...', shortcut: 'Ctrl+E', action: onExport, disabled: !hasProject },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo, disabled: !hasProject },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: onRedo, disabled: !hasProject },
    ],
    View: [
      { label: 'Zoom In', shortcut: '+', action: onZoomIn },
      { label: 'Zoom Out', shortcut: '-', action: onZoomOut },
      { label: 'Fit to Window', shortcut: 'Ctrl+0', action: onFitToWindow },
      { label: 'separator', separator: true },
      { label: 'Show Grid', action: onToggleGrid, checked: showGrid },
      { label: 'Show Map Borders', action: onToggleMapBorders, checked: showMapBorders },
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
      <span style={{ fontWeight: 700, fontSize: 13, marginRight: 12, color: 'var(--accent)' }}>
        MapArt Studio
      </span>
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
    </div>
  );
};
