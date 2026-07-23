export const MAX_XLSX_COMPRESSED_BYTES = 10 * 1024 * 1024;
export const MAX_XLSX_ARCHIVE_ENTRIES = 1_024;
export const MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
export const MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const MAX_XLSX_COMPRESSION_RATIO = 100;
export const XLSX_ARCHIVE_REJECTED_ERROR_CODE = 'xlsx_archive_rejected';
export const XLSX_ARCHIVE_REJECTED_MESSAGE =
  'XLSX 압축 파일이 손상되었거나 안전 제한을 초과했습니다.';

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MIN_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_ZIP_COMMENT_SIZE = 0xffff;
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

export type XLSXArchiveRejectionReason =
  | 'compressed-size'
  | 'malformed'
  | 'multi-disk'
  | 'zip64'
  | 'entry-count'
  | 'entry-size'
  | 'total-size'
  | 'compression-ratio'
  | 'encrypted'
  | 'compression-method';

export class XLSXArchiveValidationError extends Error {
  readonly code = XLSX_ARCHIVE_REJECTED_ERROR_CODE;
  readonly reason: XLSXArchiveRejectionReason;

  constructor(reason: XLSXArchiveRejectionReason) {
    super(XLSX_ARCHIVE_REJECTED_MESSAGE);
    this.name = 'XLSXArchiveValidationError';
    this.reason = reason;
  }
}

export interface XLSXArchivePreflightResult {
  kind: 'not-zip' | 'zip';
  entryCount: number;
  totalUncompressedBytes: number;
}

function reject(reason: XLSXArchiveRejectionReason): never {
  throw new XLSXArchiveValidationError(reason);
}

function hasRange(bytes: Uint8Array, offset: number, length: number): boolean {
  return Number.isSafeInteger(offset)
    && Number.isSafeInteger(length)
    && offset >= 0
    && length >= 0
    && offset <= bytes.length
    && length <= bytes.length - offset;
}

function uint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function uint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function rejectZIP64OrMalformedExtraFields(
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  length: number,
): void {
  if (!hasRange(bytes, offset, length)) reject('malformed');
  const end = offset + length;
  let cursor = offset;
  while (cursor < end) {
    if (end - cursor < 4) reject('malformed');
    const fieldId = uint16(view, cursor);
    const fieldLength = uint16(view, cursor + 2);
    cursor += 4;
    if (fieldLength > end - cursor) reject('malformed');
    if (fieldId === 0x0001) reject('zip64');
    cursor += fieldLength;
  }
}

function findEndOfCentralDirectory(
  bytes: Uint8Array,
  view: DataView,
): number {
  const firstPossible = Math.max(
    0,
    bytes.length
      - MIN_END_OF_CENTRAL_DIRECTORY_SIZE
      - MAX_ZIP_COMMENT_SIZE,
  );
  for (
    let offset = bytes.length - MIN_END_OF_CENTRAL_DIRECTORY_SIZE;
    offset >= firstPossible;
    offset -= 1
  ) {
    if (uint32(view, offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = uint16(view, offset + 20);
    if (offset + MIN_END_OF_CENTRAL_DIRECTORY_SIZE + commentLength === bytes.length) {
      return offset;
    }
  }
  return reject('malformed');
}

/**
 * Reads ZIP metadata only. No entry is inflated, so an unsafe workbook is
 * rejected before SheetJS can allocate based on attacker-controlled sizes.
 * Legacy OLE workbooks and HTML-as-XLS payloads are intentionally ignored.
 */
export function preflightXLSXArchive(
  bytes: Uint8Array,
): XLSXArchivePreflightResult {
  const hasPKPrefix = bytes.length >= 2
    && bytes[0] === 0x50
    && bytes[1] === 0x4b;
  if (!hasPKPrefix) {
    return {
      kind: 'not-zip',
      entryCount: 0,
      totalUncompressedBytes: 0,
    };
  }
  if (bytes.length > MAX_XLSX_COMPRESSED_BYTES) reject('compressed-size');
  if (bytes.length < MIN_END_OF_CENTRAL_DIRECTORY_SIZE) reject('malformed');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes, view);
  if (
    endOffset >= 20
    && uint32(view, endOffset - 20)
      === ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE
  ) {
    reject('zip64');
  }
  const diskNumber = uint16(view, endOffset + 4);
  const centralDirectoryDisk = uint16(view, endOffset + 6);
  const entriesOnDisk = uint16(view, endOffset + 8);
  const entryCount = uint16(view, endOffset + 10);
  const centralDirectorySize = uint32(view, endOffset + 12);
  const centralDirectoryOffset = uint32(view, endOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    reject('multi-disk');
  }
  if (
    entriesOnDisk === UINT16_MAX
    || entryCount === UINT16_MAX
    || centralDirectorySize === UINT32_MAX
    || centralDirectoryOffset === UINT32_MAX
  ) {
    reject('zip64');
  }
  if (entryCount > MAX_XLSX_ARCHIVE_ENTRIES) reject('entry-count');
  if (
    !hasRange(bytes, centralDirectoryOffset, centralDirectorySize)
    || centralDirectoryOffset + centralDirectorySize !== endOffset
  ) {
    reject('malformed');
  }

  let cursor = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (!hasRange(bytes, cursor, 46)) reject('malformed');
    if (uint32(view, cursor) !== CENTRAL_DIRECTORY_SIGNATURE) reject('malformed');

    const flags = uint16(view, cursor + 8);
    const compressionMethod = uint16(view, cursor + 10);
    const compressedSize = uint32(view, cursor + 20);
    const uncompressedSize = uint32(view, cursor + 24);
    const fileNameLength = uint16(view, cursor + 28);
    const extraLength = uint16(view, cursor + 30);
    const commentLength = uint16(view, cursor + 32);
    const startDisk = uint16(view, cursor + 34);
    const localHeaderOffset = uint32(view, cursor + 42);
    const recordLength = 46 + fileNameLength + extraLength + commentLength;

    if ((flags & 0x2041) !== 0) reject('encrypted');
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      reject('compression-method');
    }
    if (
      compressedSize === UINT32_MAX
      || uncompressedSize === UINT32_MAX
      || localHeaderOffset === UINT32_MAX
      || startDisk === UINT16_MAX
    ) {
      reject('zip64');
    }
    if (startDisk !== 0) reject('multi-disk');
    if (!hasRange(bytes, cursor, recordLength)) reject('malformed');
    rejectZIP64OrMalformedExtraFields(
      bytes,
      view,
      cursor + 46 + fileNameLength,
      extraLength,
    );
    if (uncompressedSize > MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES) reject('entry-size');
    if (
      uncompressedSize > 0
      && (
        compressedSize === 0
        || uncompressedSize > compressedSize * MAX_XLSX_COMPRESSION_RATIO
      )
    ) {
      reject('compression-ratio');
    }

    totalUncompressedBytes += uncompressedSize;
    if (
      !Number.isSafeInteger(totalUncompressedBytes)
      || totalUncompressedBytes > MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES
    ) {
      reject('total-size');
    }

    if (!hasRange(bytes, localHeaderOffset, 30)) reject('malformed');
    if (uint32(view, localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      reject('malformed');
    }
    const localNameLength = uint16(view, localHeaderOffset + 26);
    const localExtraLength = uint16(view, localHeaderOffset + 28);
    const localFlags = uint16(view, localHeaderOffset + 6);
    const localCompressionMethod = uint16(view, localHeaderOffset + 8);
    const localCompressedSize = uint32(view, localHeaderOffset + 18);
    const localUncompressedSize = uint32(view, localHeaderOffset + 22);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if ((localFlags & 0x2041) !== 0) reject('encrypted');
    if (
      localCompressionMethod !== 0
      && localCompressionMethod !== 8
    ) {
      reject('compression-method');
    }
    if (
      localCompressedSize === UINT32_MAX
      || localUncompressedSize === UINT32_MAX
    ) {
      reject('zip64');
    }
    if (localUncompressedSize > MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES) {
      reject('entry-size');
    }
    if (
      localUncompressedSize > 0
      && (
        localCompressedSize === 0
        || localUncompressedSize
          > localCompressedSize * MAX_XLSX_COMPRESSION_RATIO
      )
    ) {
      reject('compression-ratio');
    }
    if (
      localFlags !== flags
      || localCompressionMethod !== compressionMethod
    ) {
      reject('malformed');
    }
    if (
      localCompressedSize !== compressedSize
      || localUncompressedSize !== uncompressedSize
    ) {
      reject('malformed');
    }
    rejectZIP64OrMalformedExtraFields(
      bytes,
      view,
      localHeaderOffset + 30 + localNameLength,
      localExtraLength,
    );
    if (
      !hasRange(bytes, dataOffset, compressedSize)
      || dataOffset + compressedSize > centralDirectoryOffset
    ) {
      reject('malformed');
    }

    cursor += recordLength;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    reject('malformed');
  }

  return {
    kind: 'zip',
    entryCount,
    totalUncompressedBytes,
  };
}
