// Collapsible drawer component for the right panel

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DrawerProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  forceOpen?: boolean;
  children: React.ReactNode;
  previewContent?: React.ReactNode;
  onManualCollapse?: () => void;
}

const STORAGE_KEY = 'mapart-drawer-states';

function getStoredStates(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function storeState(id: string, open: boolean) {
  try {
    const states = getStoredStates();
    states[id] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch { /* ignore */ }
}

export const Drawer: React.FC<DrawerProps> = ({
  id, title, defaultOpen = false, disabled = false, disabledHint,
  forceOpen, children, previewContent, onManualCollapse,
}) => {
  const stored = getStoredStates();
  const [isOpen, setIsOpen] = useState(stored[id] ?? defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  // Handle programmatic open
  useEffect(() => {
    if (forceOpen && !isOpen && !disabled) {
      setIsOpen(true);
      storeState(id, true);
    }
  }, [forceOpen, id, isOpen, disabled]);

  const toggle = useCallback(() => {
    if (disabled) return;
    const next = !isOpen;
    setIsOpen(next);
    storeState(id, next);
    if (!next && onManualCollapse) onManualCollapse();
  }, [id, isOpen, disabled, onManualCollapse]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen, children]);

  return (
    <div className={`drawer ${isOpen ? 'open' : 'closed'} ${disabled ? 'disabled' : ''}`}>
      <div className="drawer-header" onClick={toggle}>
        <span className={`drawer-arrow ${isOpen ? 'open' : ''}`}>{'\u25B8'}</span>
        <span className="drawer-title">{title}</span>
        {disabled && disabledHint && (
          <span className="drawer-hint">{disabledHint}</span>
        )}
      </div>
      {!isOpen && previewContent && (
        <div className="drawer-preview">{previewContent}</div>
      )}
      <div
        className="drawer-content"
        ref={contentRef}
        style={{
          maxHeight: isOpen ? (maxHeight ?? 9999) : 0,
          overflow: isOpen ? undefined : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
