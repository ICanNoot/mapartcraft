// Bottom status bar with cursor position, zoom, and canvas info

import React from 'react';
import { ProjectState, MAP_SIZE } from '../../types';

interface StatusBarProps {
  project: ProjectState | null;
  cursorX: number;
  cursorY: number;
  zoom: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  project, cursorX, cursorY, zoom,
}) => {
  const mapX = cursorX >= 0 ? Math.floor(cursorX / MAP_SIZE) : -1;
  const mapY = cursorY >= 0 ? Math.floor(cursorY / MAP_SIZE) : -1;
  const localX = cursorX >= 0 ? cursorX % MAP_SIZE : -1;
  const localY = cursorY >= 0 ? cursorY % MAP_SIZE : -1;

  const inBounds = project && cursorX >= 0 && cursorX < project.pixelWidth && cursorY >= 0 && cursorY < project.pixelHeight;

  return (
    <div className="status-bar">
      {inBounds ? (
        <>
          <div className="status-item">
            <span className="status-label">Pixel:</span>
            <span className="status-value">{cursorX}, {cursorY}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Map:</span>
            <span className="status-value">{mapX},{mapY} [{localX},{localY}]</span>
          </div>
        </>
      ) : (
        <div className="status-item">
          <span className="status-label">Cursor outside canvas</span>
        </div>
      )}
      <div className="status-item">
        <span className="status-label">Zoom:</span>
        <span className="status-value">{(zoom * 100).toFixed(0)}%</span>
      </div>
      {project && (
        <>
          <div className="status-item">
            <span className="status-label">Canvas:</span>
            <span className="status-value">
              {project.mapWidth}x{project.mapHeight} maps ({project.pixelWidth}x{project.pixelHeight}px)
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Mode:</span>
            <span className="status-value">{project.conversionSettings.mapMode}</span>
          </div>
        </>
      )}
    </div>
  );
};
