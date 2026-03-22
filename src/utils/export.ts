// Export logic — converts pixel data to NBT structure files

import JSZip from 'jszip';
import {
  ProjectState, ExportSettings, ToneVariant, SupportBlockMode,
  MAP_SIZE, DATA_VERSION_1_20, EMPTY_PIXEL, decodePixel,
} from '../types';
import { BlockEntry, StructureData, writeStructureNBT, compressNBT } from './nbt';

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
  const blocks: BlockEntry[] = [];
  let maxY = 0;

  for (let col = 0; col < regionW; col++) {
    // Noobline block at z=0
    blocks.push({
      x: col,
      y: 0,
      z: 0,
      nbtName: settings.supportBlockType,
      nbtArgs: {},
    });

    // Calculate heights for this column
    const heights: number[] = [];
    let currentHeight = 1; // Start at 1 above noobline

    for (let row = 0; row < regionH; row++) {
      const globalX = startX + col;
      const globalY = startY + row;
      if (globalX >= pixelWidth || globalY >= pixelHeight) continue;

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

      // Apply height change based on tone
      if (decoded.tone === 'dark') {
        currentHeight -= 1;
      } else if (decoded.tone === 'light') {
        currentHeight += 1;
      }
      // normal stays same

      heights.push(currentHeight);
    }

    // Normalize based on staircase mode
    if (staircaseMode === 'classic') {
      const minH = Math.min(...heights);
      for (let i = 0; i < heights.length; i++) {
        heights[i] -= minH;
      }
    } else if (staircaseMode === 'valley') {
      // Valley mode: pull plateaus down
      normalizeValley(heights);
    }
    // full_dark and full_light don't need normalization since tones are uniform

    // Place blocks
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
      blocks.push({
        x: col,
        y,
        z: row + 1, // +1 for noobline
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
            x: col,
            y: y - 1,
            z: row + 1,
            nbtName: settings.supportBlockType,
            nbtArgs: {},
          });
        }
      }

      if (y > maxY) maxY = y;
    }
  }

  return {
    sizeX: regionW,
    sizeY: maxY + 1,
    sizeZ: regionH + 1, // +1 for noobline
    blocks,
    dataVersion: DATA_VERSION_1_20,
  };
}

/**
 * Valley normalization: pull ascending plateaus down
 */
function normalizeValley(heights: number[]) {
  if (heights.length === 0) return;

  // Find minimum and shift so min=0
  const minH = Math.min(...heights);
  for (let i = 0; i < heights.length; i++) {
    heights[i] -= minH;
  }

  // Additional valley optimization: find plateau sections and pull them down
  let i = 0;
  while (i < heights.length) {
    // Find start of ascending plateau
    let plateauStart = i;
    while (i < heights.length - 1 && heights[i + 1] >= heights[i]) {
      i++;
    }
    let plateauEnd = i;

    // If this plateau is higher than both sides, pull it down
    if (plateauEnd > plateauStart) {
      const leftH = plateauStart > 0 ? heights[plateauStart - 1] : 0;
      const rightH = plateauEnd < heights.length - 1 ? heights[plateauEnd + 1] : 0;
      const targetH = Math.max(leftH, rightH);

      if (heights[plateauStart] > targetH) {
        const pullDown = heights[plateauStart] - targetH;
        // Only pull down if it doesn't break relative ordering
        for (let j = plateauStart; j <= plateauEnd; j++) {
          heights[j] = Math.max(0, heights[j] - pullDown);
        }
      }
    }
    i++;
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
