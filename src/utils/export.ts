// Export logic — converts pixel data to NBT structure files

import JSZip from 'jszip';
import {
  ProjectState, ExportSettings, ToneVariant, SupportBlockMode,
  MAP_SIZE, DATA_VERSION_1_20, EMPTY_PIXEL, decodePixel, MaterialEntry,
} from '../types';
import { BlockEntry, StructureData, writeStructureNBT, writeMapDatNBT, compressNBT } from './nbt';

interface ColourData {
  blocks: Record<string, {
    validVersions: Record<string, { NBTName: string; NBTArgs: Record<string, string> } | string>;
    supportBlockMandatory: boolean;
  }>;
}

function resolveBlockNBT(
  block: any,
  version: string
): { nbtName: string; nbtArgs: Record<string, string> } | null {
  const vData = block.validVersions?.[version];
  if (!vData) return null;
  if (typeof vData === 'string') {
    // Reference like "&1.13.2"
    const refVersion = vData.replace('&', '');
    return resolveBlockNBT(block, refVersion);
  }
  return { nbtName: vData.NBTName, nbtArgs: vData.NBTArgs || {} };
}

function getBlockNBTInfo(
  coloursData: Record<string, any>,
  colourSetId: number,
  blockIndex: number,
  version: string
): { nbtName: string; nbtArgs: Record<string, string>; supportBlockMandatory: boolean } | null {
  const cs = coloursData[colourSetId.toString()];
  if (!cs) return null;
  const block = cs.blocks[blockIndex.toString()];
  if (!block) return null;
  const nbt = resolveBlockNBT(block, version);
  if (!nbt) return null;
  return { ...nbt, supportBlockMandatory: block.supportBlockMandatory };
}

/**
 * Generate flat map structure data for a region of the canvas
 */
function generateFlatStructure(
  pixels: Uint16Array,
  pixelWidth: number,
  pixelHeight: number,
  startX: number, startY: number,
  regionW: number, regionH: number,
  coloursData: Record<string, any>,
  blockChoices: Record<number, number>,
  settings: ExportSettings
): StructureData {
  const blocks: BlockEntry[] = [];
  const baseY = 2; // Flat maps start at Y=2

  for (let py = 0; py < regionH; py++) {
    for (let px = 0; px < regionW; px++) {
      const globalX = startX + px;
      const globalY = startY + py;
      if (globalX >= pixelWidth || globalY >= pixelHeight) continue;

      const encoded = pixels[globalY * pixelWidth + globalX];
      if (encoded === EMPTY_PIXEL) continue;

      const decoded = decodePixel(encoded);
      if (!decoded) continue;

      const blockIdx = blockChoices[decoded.colourSetId] ?? 0;
      const blockInfo = getBlockNBTInfo(coloursData, decoded.colourSetId, blockIdx, settings.version);
      if (!blockInfo) continue;

      blocks.push({
        x: px,
        y: baseY,
        z: py,
        nbtName: blockInfo.nbtName,
        nbtArgs: blockInfo.nbtArgs,
      });

      // Support blocks
      if (settings.supportBlockMode !== 'none') {
        const needSupport =
          settings.supportBlockMode === 'all_optimized' ||
          settings.supportBlockMode === 'all_double_optimized' ||
          (settings.supportBlockMode === 'important_only' && blockInfo.supportBlockMandatory);

        if (needSupport) {
          blocks.push({
            x: px,
            y: baseY - 1,
            z: py,
            nbtName: settings.supportBlockType,
            nbtArgs: {},
          });

          if (settings.supportBlockMode === 'all_double_optimized') {
            blocks.push({
              x: px,
              y: baseY - 2,
              z: py,
              nbtName: settings.supportBlockType,
              nbtArgs: {},
            });
          }
        }
      }
    }
  }

  let sizeY = 3; // Y=0,1,2
  if (settings.supportBlockMode === 'none') sizeY = 3;
  if (settings.supportBlockMode === 'all_double_optimized') sizeY = 3;

  return {
    sizeX: regionW,
    sizeY,
    sizeZ: regionH,
    blocks,
    dataVersion: DATA_VERSION_1_20,
  };
}

/**
 * Generate staircase map structure data for a region of the canvas
 */
function generateStaircaseStructure(
  pixels: Uint16Array,
  pixelWidth: number,
  pixelHeight: number,
  startX: number, startY: number,
  regionW: number, regionH: number,
  coloursData: Record<string, any>,
  blockChoices: Record<number, number>,
  settings: ExportSettings,
  staircaseMode: string
): StructureData {
  const allBlocks: BlockEntry[] = [];
  const supportBlockName = settings.supportBlockType;

  for (let col = 0; col < regionW; col++) {
    // Step 1: Calculate raw heights for this column
    const heights: number[] = [];
    let currentHeight = 0;

    for (let row = 0; row < regionH; row++) {
      const globalX = startX + col;
      const globalY = startY + row;
      if (globalX >= pixelWidth || globalY >= pixelHeight) {
        heights.push(currentHeight);
        continue;
      }

      const encoded = pixels[globalY * pixelWidth + globalX];
      if (encoded === EMPTY_PIXEL) {
        heights.push(currentHeight);
        continue;
      }

      const decoded = decodePixel(encoded);
      if (!decoded) {
        heights.push(currentHeight);
        continue;
      }

      if (decoded.tone === 'dark') {
        currentHeight -= 1;
      } else if (decoded.tone === 'light') {
        currentHeight += 1;
      }

      heights.push(currentHeight);
    }

    // Step 2: Build column block array (noobline + map blocks + support blocks)
    const columnBlocks: BlockEntry[] = [];

    // Noobline block at z=0, y=0 (relative to this column's height origin)
    const nooblineY = 0;
    columnBlocks.push({
      x: col,
      y: nooblineY,
      z: 0,
      nbtName: supportBlockName,
      nbtArgs: {},
    });

    // Map blocks and support blocks
    for (let row = 0; row < heights.length; row++) {
      const globalX = startX + col;
      const globalY = startY + row;
      if (globalX >= pixelWidth || globalY >= pixelHeight) continue;

      const encoded = pixels[globalY * pixelWidth + globalX];
      if (encoded === EMPTY_PIXEL) continue;

      const decoded = decodePixel(encoded);
      if (!decoded) continue;

      const blockIdx = blockChoices[decoded.colourSetId] ?? 0;
      const blockInfo = getBlockNBTInfo(coloursData, decoded.colourSetId, blockIdx, settings.version);
      if (!blockInfo) continue;

      const y = heights[row];
      columnBlocks.push({
        x: col,
        y,
        z: row + 1,
        nbtName: blockInfo.nbtName,
        nbtArgs: blockInfo.nbtArgs,
      });

      if (settings.supportBlockMode !== 'none') {
        const needSupport =
          settings.supportBlockMode === 'all_optimized' ||
          settings.supportBlockMode === 'all_double_optimized' ||
          (settings.supportBlockMode === 'important_only' && blockInfo.supportBlockMandatory);

        if (needSupport) {
          columnBlocks.push({
            x: col,
            y: y - 1,
            z: row + 1,
            nbtName: supportBlockName,
            nbtArgs: {},
          });
        }
      }
    }

    // Step 3: Apply normalization
    if (staircaseMode === 'classic') {
      normalizeClassic(columnBlocks);
    } else if (staircaseMode === 'valley') {
      normalizeValley(columnBlocks, supportBlockName);
    }

    for (const block of columnBlocks) {
      allBlocks.push(block);
    }
  }

  // Step 4: Global shift so minimum Y = 0
  let globalMinY = Infinity;
  for (const block of allBlocks) {
    if (block.y < globalMinY) globalMinY = block.y;
  }
  if (globalMinY < 0) {
    const shift = -globalMinY;
    for (const block of allBlocks) {
      block.y += shift;
    }
  }

  // Step 5: Calculate sizeY from actual max Y
  let globalMaxY = 0;
  for (const block of allBlocks) {
    if (block.y > globalMaxY) globalMaxY = block.y;
  }

  return {
    sizeX: regionW,
    sizeY: globalMaxY + 1,
    sizeZ: regionH + 1,
    blocks: allBlocks,
    dataVersion: DATA_VERSION_1_20,
  };
}

/**
 * Classic normalization: shift all blocks in the column so the minimum Y = 0
 */
function normalizeClassic(columnBlocks: BlockEntry[]) {
  let minY = Infinity;
  for (const block of columnBlocks) {
    if (block.y < minY) minY = block.y;
  }
  if (minY !== 0) {
    for (const block of columnBlocks) {
      block.y -= minY;
    }
  }
}

/**
 * Valley normalization: plateau detection and pulldown algorithm.
 * Ported from MapartCraft's nbt.jsworker.
 * Operates on the finalized block array for a single column.
 */
function normalizeValley(columnBlocks: BlockEntry[], supportBlockName: string) {
  if (columnBlocks.length === 0) return;

  // Sort by Z ascending, then Y descending (so visible map block comes before support blocks at same Z)
  columnBlocks.sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    return b.y - a.y;
  });

  // Step 1: Identify plateaus
  const plateaus: { startIndex: number; endIndex: number }[] = [
    { startIndex: 0, endIndex: 0 }, // dummy zero-width plateau
  ];
  let ascending = false;
  let currentPlateauStartIndex = 0;
  // visibleBlocksHeight starts at the noobline block's Y (first block after sort, index 0)
  let visibleBlocksHeight = columnBlocks[0].y;

  for (let i = 0; i < columnBlocks.length; i++) {
    const block = columnBlocks[i];
    // Skip scaffold/support blocks
    if (block.nbtName === supportBlockName) {
      continue;
    }
    if (ascending && block.y < visibleBlocksHeight) {
      // Dark tone after an ascent — plateau found
      ascending = false;
      plateaus.push({ startIndex: currentPlateauStartIndex, endIndex: i });
    } else if (block.y > visibleBlocksHeight) {
      ascending = true;
      currentPlateauStartIndex = i;
    }
    visibleBlocksHeight = block.y;
  }

  // Sentinel plateau
  plateaus.push({ startIndex: columnBlocks.length, endIndex: columnBlocks.length });

  // Step 2: Pull down valleys and plateaus
  const nonPlateauPulldownHeights = [Infinity, Infinity];

  while (plateaus.length > 1) {
    // Non-plateau section: from plateaus[0].endIndex to plateaus[1].startIndex
    let pullDownHeight = Infinity;
    for (let i = plateaus[0].endIndex; i < plateaus[1].startIndex; i++) {
      if (columnBlocks[i].y < pullDownHeight) {
        pullDownHeight = columnBlocks[i].y;
      }
    }
    if (pullDownHeight !== Infinity) {
      for (let i = plateaus[0].endIndex; i < plateaus[1].startIndex; i++) {
        columnBlocks[i].y -= pullDownHeight;
      }
    } else {
      pullDownHeight = 0;
    }
    nonPlateauPulldownHeights[1] = pullDownHeight;

    const plateauPulldownHeight = Math.min(nonPlateauPulldownHeights[0], nonPlateauPulldownHeights[1]);
    for (let i = plateaus[0].startIndex; i < plateaus[0].endIndex; i++) {
      columnBlocks[i].y -= plateauPulldownHeight;
    }

    plateaus.shift();
    nonPlateauPulldownHeights[0] = nonPlateauPulldownHeights[1];
  }
}

/**
 * Export the full project as NBT file(s)
 */
export async function exportProject(
  project: ProjectState,
  coloursData: Record<string, any>,
  settings: ExportSettings
): Promise<{ filename: string; data: Uint8Array }[]> {
  const results: { filename: string; data: Uint8Array }[] = [];

  if (settings.splitExport) {
    // Split into 128x128 sections
    for (let my = 0; my < project.mapHeight; my++) {
      for (let mx = 0; mx < project.mapWidth; mx++) {
        const startX = mx * MAP_SIZE;
        const startY = my * MAP_SIZE;

        const structure = project.conversionSettings.mapMode === 'flat'
          ? generateFlatStructure(
              project.pixels, project.pixelWidth, project.pixelHeight,
              startX, startY, MAP_SIZE, MAP_SIZE,
              coloursData, project.blockChoices, settings
            )
          : generateStaircaseStructure(
              project.pixels, project.pixelWidth, project.pixelHeight,
              startX, startY, MAP_SIZE, MAP_SIZE,
              coloursData, project.blockChoices, settings,
              project.conversionSettings.staircaseMode
            );

        const nbtData = writeStructureNBT(structure);
        const compressed = compressNBT(nbtData);
        results.push({
          filename: `${settings.filename}_${mx}_${my}.nbt`,
          data: compressed,
        });
      }
    }
  } else {
    // Single file
    const structure = project.conversionSettings.mapMode === 'flat'
      ? generateFlatStructure(
          project.pixels, project.pixelWidth, project.pixelHeight,
          0, 0, project.pixelWidth, project.pixelHeight,
          coloursData, project.blockChoices, settings
        )
      : generateStaircaseStructure(
          project.pixels, project.pixelWidth, project.pixelHeight,
          0, 0, project.pixelWidth, project.pixelHeight,
          coloursData, project.blockChoices, settings,
          project.conversionSettings.staircaseMode
        );

    const nbtData = writeStructureNBT(structure);
    const compressed = compressNBT(nbtData);
    results.push({
      filename: `${settings.filename}.nbt`,
      data: compressed,
    });
  }

  return results;
}

/**
 * Export the project as map.dat file(s)
 */
export async function exportMapDat(
  project: ProjectState,
  coloursData: Record<string, any>,
  settings: ExportSettings
): Promise<{ filename: string; data: Uint8Array }[]> {
  const results: { filename: string; data: Uint8Array }[] = [];

  for (let my = 0; my < project.mapHeight; my++) {
    for (let mx = 0; mx < project.mapWidth; mx++) {
      const colors = new Uint8Array(16384); // 128x128

      for (let z = 0; z < MAP_SIZE; z++) {
        for (let x = 0; x < MAP_SIZE; x++) {
          const globalX = mx * MAP_SIZE + x;
          const globalY = my * MAP_SIZE + z;
          if (globalX >= project.pixelWidth || globalY >= project.pixelHeight) continue;

          const encoded = project.pixels[globalY * project.pixelWidth + globalX];
          if (encoded === EMPTY_PIXEL) {
            colors[z * 128 + x] = 0; // transparent
            continue;
          }

          const decoded = decodePixel(encoded);
          if (!decoded) {
            colors[z * 128 + x] = 0;
            continue;
          }

          const cs = coloursData[decoded.colourSetId.toString()];
          if (!cs || cs.mapdatId === undefined) {
            colors[z * 128 + x] = 0;
            continue;
          }

          // mapColorId = baseMapdatId * 4 + toneOffset
          const toneOffset = decoded.tone === 'dark' ? 0
            : decoded.tone === 'normal' ? 1
            : decoded.tone === 'light' ? 2
            : 3; // unobtainable
          colors[z * 128 + x] = cs.mapdatId * 4 + toneOffset;
        }
      }

      const mapId = settings.startingMapId + my * project.mapWidth + mx;
      const nbtData = writeMapDatNBT(colors, DATA_VERSION_1_20);
      const compressed = compressNBT(nbtData);
      results.push({
        filename: `map_${mapId}.dat`,
        data: compressed,
      });
    }
  }

  return results;
}

/**
 * Calculate materials list from project pixel data
 */
export function calculateMaterials(
  project: ProjectState,
  coloursData: Record<string, any>,
  supportBlockMode: SupportBlockMode,
  supportBlockType: string,
  version: string
): MaterialEntry[] {
  const counts = new Map<string, MaterialEntry>();

  for (let i = 0; i < project.pixels.length; i++) {
    const encoded = project.pixels[i];
    if (encoded === EMPTY_PIXEL) continue;

    const decoded = decodePixel(encoded);
    if (!decoded) continue;

    const cs = coloursData[decoded.colourSetId.toString()];
    if (!cs) continue;

    const blockIdx = project.blockChoices[decoded.colourSetId] ?? 0;
    const block = cs.blocks[blockIdx.toString()];
    if (!block) continue;

    const blockName = block.displayName || 'Unknown';
    const nbtInfo = resolveBlockNBT(block, version);
    const nbtName = nbtInfo?.nbtName || 'unknown';
    const key = `${decoded.colourSetId}_${blockIdx}`;

    if (counts.has(key)) {
      counts.get(key)!.count++;
    } else {
      counts.set(key, { blockName, nbtName, count: 1, colourSetId: decoded.colourSetId });
    }

    // Count support blocks
    if (supportBlockMode !== 'none') {
      const needSupport =
        supportBlockMode === 'all_optimized' ||
        supportBlockMode === 'all_double_optimized' ||
        (supportBlockMode === 'important_only' && block.supportBlockMandatory);

      if (needSupport) {
        const supportKey = `support_${supportBlockType}`;
        const mult = supportBlockMode === 'all_double_optimized' ? 2 : 1;
        if (counts.has(supportKey)) {
          counts.get(supportKey)!.count += mult;
        } else {
          counts.set(supportKey, {
            blockName: supportBlockType.charAt(0).toUpperCase() + supportBlockType.slice(1),
            nbtName: supportBlockType,
            count: mult,
            colourSetId: -1,
          });
        }
      }
    }
  }

  // Add noobline blocks for staircase mode
  if (project.conversionSettings.mapMode === 'staircase') {
    const nooblineCount = project.pixelWidth; // 128 per map width
    const supportKey = `noobline_${supportBlockType}`;
    if (counts.has(`support_${supportBlockType}`)) {
      counts.get(`support_${supportBlockType}`)!.count += nooblineCount;
    } else {
      counts.set(supportKey, {
        blockName: `${supportBlockType.charAt(0).toUpperCase() + supportBlockType.slice(1)} (noobline)`,
        nbtName: supportBlockType,
        count: nooblineCount,
        colourSetId: -1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

/**
 * Bundle multiple files into a ZIP
 */
export async function bundleAsZip(
  files: { filename: string; data: Uint8Array }[]
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.data);
  }
  const content = await zip.generateAsync({ type: 'uint8array' });
  return content;
}
