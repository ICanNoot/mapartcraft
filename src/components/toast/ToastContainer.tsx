// Toast notification system — non-blocking feedback at bottom-centre

import React from 'react';
import { Toast } from '../../types';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const BORDER_COLOURS: Record<Toast['type'], string> = {
  info: 'var(--accent)',
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="toast"
          style={{ borderLeftColor: BORDER_COLOURS[toast.type] }}
          onClick={() => onDismiss(toast.id)}
        >
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
