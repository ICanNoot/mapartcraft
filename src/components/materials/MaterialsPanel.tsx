// Materials list panel — shows block counts for building the map art

import React, { useMemo } from 'react';
import { ProjectState, SupportBlockMode, MaterialEntry } from '../../types';
import { calculateMaterials } from '../../utils/export';

interface MaterialsPanelProps {
  project: ProjectState | null;
  coloursData: Record<string, any> | null;
}

export const MaterialsPanel: React.FC<MaterialsPanelProps> = ({ project, coloursData }) => {
  const materials = useMemo((): MaterialEntry[] => {
    if (!project || !coloursData) return [];
    return calculateMaterials(
      project, coloursData,
      'important_only', 'stone', '1.20'
    );
  }, [project, coloursData]);

  const totalBlocks = useMemo(() => {
    return materials.reduce((sum, m) => sum + m.count, 0);
  }, [materials]);

  const totalStacks = Math.ceil(totalBlocks / 64);
  const totalShulkers = Math.ceil(totalStacks / 27);

  const exportMaterialsList = () => {
    if (materials.length === 0) return;
    const lines = ['Block Name\tCount\tStacks\tShulker Boxes'];
    for (const m of materials) {
      const stacks = Math.ceil(m.count / 64);
      const shulkers = Math.ceil(stacks / 27);
      lines.push(`${m.blockName}\t${m.count}\t${stacks}\t${shulkers}`);
    }
    lines.push('');
    lines.push(`Total\t${totalBlocks}\t${totalStacks}\t${totalShulkers}`);

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'materials.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) {
    return (
      <div className="materials-panel">
        <div className="settings-notice">Import an image to see materials list.</div>
      </div>
    );
  }

  return (
    <div className="materials-panel">
      <div className="materials-summary">
        <span>{materials.length} block types</span>
        <span>{totalBlocks.toLocaleString()} total</span>
        <span>{totalStacks.toLocaleString()} stacks</span>
      </div>
      <div className="materials-list">
        {materials.map((m, i) => {
          const stacks = Math.ceil(m.count / 64);
          return (
            <div key={i} className="material-row">
              <span className="material-name">{m.blockName}</span>
              <span className="material-count">
                {m.count.toLocaleString()}
                <span className="material-stacks">({stacks}s)</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="materials-actions">
        <button className="btn" onClick={exportMaterialsList}>Export Materials</button>
      </div>
    </div>
  );
};
