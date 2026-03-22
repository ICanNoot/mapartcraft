// NBT Writer — based on MapartCraft's nbt.jsworker implementation
// Writes Minecraft structure NBT format for Litematica import

import pako from 'pako';

// NBT Tag IDs
const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_FLOAT = 5;
const TAG_DOUBLE = 6;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;
const TAG_LONG_ARRAY = 12;

class NBTWriter {
  private buffer: number[] = [];

  writeByte(value: number) {
    this.buffer.push(value & 0xFF);
  }

  writeShort(value: number) {
    this.buffer.push((value >> 8) & 0xFF);
    this.buffer.push(value & 0xFF);
  }

  writeInt(value: number) {
    this.buffer.push((value >> 24) & 0xFF);
    this.buffer.push((value >> 16) & 0xFF);
    this.buffer.push((value >> 8) & 0xFF);
    this.buffer.push(value & 0xFF);
  }

  writeLong(high: number, low: number) {
    this.writeInt(high);
    this.writeInt(low);
  }

  writeFloat(value: number) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, false);
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) this.buffer.push(bytes[i]);
  }

  writeDouble(value: number) {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, false);
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < 8; i++) this.buffer.push(bytes[i]);
  }

  writeString(str: string) {
    const encoded = new TextEncoder().encode(str);
    this.writeShort(encoded.length);
    for (let i = 0; i < encoded.length; i++) {
      this.buffer.push(encoded[i]);
    }
  }

  writeTagHeader(tagType: number, name: string) {
    this.writeByte(tagType);
    this.writeString(name);
  }

  writeCompoundTag(name: string, writeContents: () => void) {
    this.writeTagHeader(TAG_COMPOUND, name);
    writeContents();
    this.writeByte(TAG_END);
  }

  writeInlineCompound(writeContents: () => void) {
    writeContents();
    this.writeByte(TAG_END);
  }

  writeIntTag(name: string, value: number) {
    this.writeTagHeader(TAG_INT, name);
    this.writeInt(value);
  }

  writeStringTag(name: string, value: string) {
    this.writeTagHeader(TAG_STRING, name);
    this.writeString(value);
  }

  writeByteTag(name: string, value: number) {
    this.writeTagHeader(TAG_BYTE, name);
    this.writeByte(value);
  }

  writeShortTag(name: string, value: number) {
    this.writeTagHeader(TAG_SHORT, name);
    this.writeShort(value);
  }

  writeListTag(name: string, elementType: number, length: number) {
    this.writeTagHeader(TAG_LIST, name);
    this.writeByte(elementType);
    this.writeInt(length);
  }

  writeInlineListTag(elementType: number, length: number) {
    this.writeByte(elementType);
    this.writeInt(length);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export interface BlockEntry {
  x: number;
  y: number;
  z: number;
  nbtName: string;
  nbtArgs: Record<string, string>;
}

export interface StructureData {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  blocks: BlockEntry[];
  dataVersion: number;
}

/**
 * Write a Minecraft structure NBT file
 */
export function writeStructureNBT(data: StructureData): Uint8Array {
  const writer = new NBTWriter();

  // Build palette
  const paletteMap = new Map<string, number>();
  const paletteEntries: { name: string; args: Record<string, string> }[] = [];

  for (const block of data.blocks) {
    const key = block.nbtName + JSON.stringify(block.nbtArgs);
    if (!paletteMap.has(key)) {
      paletteMap.set(key, paletteEntries.length);
      paletteEntries.push({ name: block.nbtName, args: block.nbtArgs });
    }
  }

  // Root compound
  writer.writeTagHeader(TAG_COMPOUND, '');

  // DataVersion
  writer.writeIntTag('DataVersion', data.dataVersion);

  // author
  writer.writeStringTag('author', 'MapArt Studio');

  // size — TAG_List of TAG_Int
  writer.writeListTag('size', TAG_INT, 3);
  writer.writeInt(data.sizeX);
  writer.writeInt(data.sizeY);
  writer.writeInt(data.sizeZ);

  // palette — TAG_List of TAG_Compound
  writer.writeListTag('palette', TAG_COMPOUND, paletteEntries.length);
  for (const entry of paletteEntries) {
    // Each compound in the list (no header needed, inline)
    writer.writeStringTag('Name', 'minecraft:' + entry.name);
    if (Object.keys(entry.args).length > 0) {
      writer.writeTagHeader(TAG_COMPOUND, 'Properties');
      for (const [propKey, propVal] of Object.entries(entry.args)) {
        writer.writeStringTag(propKey, propVal);
      }
      writer.writeByte(TAG_END);
    }
    writer.writeByte(TAG_END); // end compound
  }

  // blocks — TAG_List of TAG_Compound
  writer.writeListTag('blocks', TAG_COMPOUND, data.blocks.length);
  for (const block of data.blocks) {
    const key = block.nbtName + JSON.stringify(block.nbtArgs);
    const stateIndex = paletteMap.get(key)!;

    // pos — TAG_List of TAG_Int
    writer.writeListTag('pos', TAG_INT, 3);
    writer.writeInt(block.x);
    writer.writeInt(block.y);
    writer.writeInt(block.z);

    writer.writeIntTag('state', stateIndex);

    writer.writeByte(TAG_END); // end block compound
  }

  // entities — empty TAG_List
  writer.writeListTag('entities', TAG_END, 0);

  writer.writeByte(TAG_END); // end root compound

  return writer.toUint8Array();
}

/**
 * Compress NBT data with gzip
 */
export function compressNBT(data: Uint8Array): Uint8Array {
  return pako.gzip(data);
}
