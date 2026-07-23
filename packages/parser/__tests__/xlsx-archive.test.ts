import { describe, expect, test } from 'bun:test';
import {
  MAX_XLSX_ARCHIVE_ENTRIES,
  MAX_XLSX_COMPRESSED_BYTES,
  MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES,
  preflightXLSXArchive,
  XLSX_ARCHIVE_REJECTED_ERROR_CODE,
  XLSXArchiveValidationError,
} from '../src/shared/xlsx-archive.js';
import { parseXLSXBuffer } from '../src/xlsx/index.js';

interface TestEntry {
  compressed: number;
  uncompressed: number;
}

function makeZip(entries: readonly TestEntry[]): Uint8Array {
  const localSize = entries.reduce((sum, entry) => sum + 31 + entry.compressed, 0);
  const centralSize = entries.length * 47;
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  const write16 = (offset: number, value: number): void =>
    view.setUint16(offset, value, true);
  const write32 = (offset: number, value: number): void =>
    view.setUint32(offset, value, true);

  let localCursor = 0;
  const localOffsets: number[] = [];
  for (const [index, entry] of entries.entries()) {
    localOffsets.push(localCursor);
    write32(localCursor, 0x04034b50);
    write16(localCursor + 4, 20);
    write16(localCursor + 8, 8);
    write32(localCursor + 18, entry.compressed);
    write32(localCursor + 22, entry.uncompressed);
    write16(localCursor + 26, 1);
    bytes[localCursor + 30] = 65 + (index % 26);
    localCursor += 31 + entry.compressed;
  }

  const centralOffset = localCursor;
  for (const [index, entry] of entries.entries()) {
    write32(localCursor, 0x02014b50);
    write16(localCursor + 4, 20);
    write16(localCursor + 6, 20);
    write16(localCursor + 10, 8);
    write32(localCursor + 20, entry.compressed);
    write32(localCursor + 24, entry.uncompressed);
    write16(localCursor + 28, 1);
    write32(localCursor + 42, localOffsets[index]!);
    bytes[localCursor + 46] = 65 + (index % 26);
    localCursor += 47;
  }

  write32(localCursor, 0x06054b50);
  write16(localCursor + 8, entries.length);
  write16(localCursor + 10, entries.length);
  write32(localCursor + 12, centralSize);
  write32(localCursor + 16, centralOffset);
  return bytes;
}

function expectRejection(
  bytes: Uint8Array,
  reason: XLSXArchiveValidationError['reason'],
): void {
  try {
    preflightXLSXArchive(bytes);
    throw new Error('expected ZIP preflight rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(XLSXArchiveValidationError);
    expect((error as XLSXArchiveValidationError).reason).toBe(reason);
  }
}

describe('XLSX ZIP preflight', () => {
  test('leaves OLE and HTML payloads on their existing parsing paths', () => {
    expect(preflightXLSXArchive(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])).kind)
      .toBe('not-zip');
    expect(preflightXLSXArchive(new TextEncoder().encode('<table></table>')).kind)
      .toBe('not-zip');
  });

  test('accepts bounded central-directory metadata', () => {
    expect(preflightXLSXArchive(makeZip([
      { compressed: 100, uncompressed: 1_000 },
      { compressed: 50, uncompressed: 2_000 },
    ]))).toEqual({
      kind: 'zip',
      entryCount: 2,
      totalUncompressedBytes: 3_000,
    });
  });

  test('rejects entry, aggregate, ratio, and entry-count bombs', () => {
    const oversizedCompressed = new Uint8Array(
      MAX_XLSX_COMPRESSED_BYTES + 1,
    );
    oversizedCompressed.set([0x50, 0x4b]);
    expectRejection(oversizedCompressed, 'compressed-size');

    expectRejection(makeZip([{
      compressed: Math.ceil((MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES + 1) / 100),
      uncompressed: MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES + 1,
    }]), 'entry-size');

    const aggregateEntrySize = Math.floor(MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES / 4);
    expectRejection(makeZip(Array.from({ length: 5 }, () => ({
      compressed: Math.ceil(aggregateEntrySize / 100),
      uncompressed: aggregateEntrySize,
    }))), 'total-size');

    expectRejection(makeZip([{ compressed: 1, uncompressed: 101 }]), 'compression-ratio');
    expectRejection(makeZip(Array.from(
      { length: MAX_XLSX_ARCHIVE_ENTRIES + 1 },
      () => ({ compressed: 0, uncompressed: 0 }),
    )), 'entry-count');
  });

  test('rejects malformed, multi-disk, and ZIP64 EOCD metadata', () => {
    const malformed = makeZip([{ compressed: 1, uncompressed: 1 }]);
    new DataView(malformed.buffer).setUint32(malformed.length - 6, 0xfffffff0, true);
    expectRejection(malformed, 'malformed');

    const multiDisk = makeZip([]);
    new DataView(multiDisk.buffer).setUint16(multiDisk.length - 18, 1, true);
    expectRejection(multiDisk, 'multi-disk');

    const zip64 = makeZip([]);
    new DataView(zip64.buffer).setUint16(zip64.length - 14, 0xffff, true);
    new DataView(zip64.buffer).setUint16(zip64.length - 12, 0xffff, true);
    expectRejection(zip64, 'zip64');
  });

  test('rejects unsafe or inconsistent local-header metadata', () => {
    const oversizedLocal = makeZip([{ compressed: 100, uncompressed: 1_000 }]);
    new DataView(oversizedLocal.buffer).setUint32(
      22,
      MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES + 1,
      true,
    );
    expectRejection(oversizedLocal, 'entry-size');

    const compressedMismatch = makeZip([{
      compressed: 100,
      uncompressed: 1_000,
    }]);
    new DataView(compressedMismatch.buffer).setUint32(18, 99, true);
    expectRejection(compressedMismatch, 'malformed');

    const methodMismatch = makeZip([{ compressed: 100, uncompressed: 1_000 }]);
    new DataView(methodMismatch.buffer).setUint16(8, 0, true);
    expectRejection(methodMismatch, 'malformed');

    const encryptedLocal = makeZip([{ compressed: 100, uncompressed: 1_000 }]);
    new DataView(encryptedLocal.buffer).setUint16(6, 1, true);
    expectRejection(encryptedLocal, 'encrypted');

    const zeroSizedDescriptor = makeZip([{
      compressed: 100,
      uncompressed: 1_000,
    }]);
    const descriptorView = new DataView(zeroSizedDescriptor.buffer);
    descriptorView.setUint16(6, 0x8, true);
    descriptorView.setUint32(18, 0, true);
    descriptorView.setUint32(22, 0, true);
    const centralOffset = 31 + 100;
    descriptorView.setUint16(centralOffset + 8, 0x8, true);
    expectRejection(zeroSizedDescriptor, 'malformed');
  });

  test('returns a sanitized parser error instead of invoking archive inflation', () => {
    const result = parseXLSXBuffer(makeZip([{ compressed: 1, uncompressed: 101 }]));
    expect(result.transactions).toEqual([]);
    expect(result.errors[0]?.code).toBe(XLSX_ARCHIVE_REJECTED_ERROR_CODE);
    expect(result.errors[0]?.message).not.toContain('compression-ratio');
  });
});
