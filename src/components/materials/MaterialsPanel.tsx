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

  const formatNum = (n: number) => n.toLocaleString('en-US');

  const exportMaterialsTxt = () => {
    if (materials.length === 0) return;
    // Compute column widths
    const nameHeader = 'Block Name';
    const rows = materials.map(m => ({
      name: m.blockName,
      count: formatNum(m.count),
      stacks: formatNum(Math.ceil(m.count / 64)),
      shulkers: formatNum(Math.ceil(Math.ceil(m.count / 64) / 27)),
    }));
    const totalRow = {
      name: 'TOTAL',
      count: formatNum(totalBlocks),
      stacks: formatNum(totalStacks),
      shulkers: formatNum(totalShulkers),
    };

    const nameW = Math.max(nameHeader.length, ...rows.map(r => r.name.length), totalRow.name.length) + 2;
    const countW = Math.max(5, ...rows.map(r => r.count.length), totalRow.count.length);
    const stackW = Math.max(6, ...rows.map(r => r.stacks.length), totalRow.stacks.length);
    const shulkW = Math.max(7, ...rows.map(r => r.shulkers.length), totalRow.shulkers.length);

    const pad = (s: string, w: number, right = false) => right ? s.padStart(w) : s.padEnd(w);

    const lines: string[] = [];
    lines.push(`${pad(nameHeader, nameW)}  ${pad('Count', countW, true)}  ${pad('Stacks', stackW, true)}  ${pad('Shulkers', shulkW, true)}`);
    lines.push('-'.repeat(nameW + countW + stackW + shulkW + 6));
    for (const r of rows) {
      lines.push(`${pad(r.name, nameW)}  ${pad(r.count, countW, true)}  ${pad(r.stacks, stackW, true)}  ${pad(r.shulkers, shulkW, true)}`);
    }
    lines.push('-'.repeat(nameW + countW + stackW + shulkW + 6));
    lines.push(`${pad(totalRow.name, nameW)}  ${pad(totalRow.count, countW, true)}  ${pad(totalRow.stacks, stackW, true)}  ${pad(totalRow.shulkers, shulkW, true)}`);

    downloadText(lines.join('\n'), 'materials.txt', 'text/plain');
  };

  const exportMaterialsCsv = () => {
    if (materials.length === 0) return;
    const lines = ['Block Name,Count,Stacks,Shulker Boxes'];
    for (const m of materials) {
      const stacks = Math.ceil(m.count / 64);
      const shulkers = Math.ceil(stacks / 27);
      lines.push(`"${m.blockName}",${m.count},${stacks},${shulkers}`);
    }
    lines.push(`"Total",${totalBlocks},${totalStacks},${totalShulkers}`);
    downloadText(lines.join('\n'), 'materials.csv', 'text/csv');
  };

  const downloadText = (text: string, filename: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
        <button className="btn" onClick={exportMaterialsTxt}>Export .txt</button>
        <button className="btn" onClick={exportMaterialsCsv}>Export .csv</button>
      </div>
    </div>
  );
};
