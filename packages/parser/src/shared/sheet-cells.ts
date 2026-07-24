export const MAX_WORKBOOK_SHEETS = 64;
export const MAX_WORKSHEET_ROWS = 100_000;
export const MAX_WORKSHEET_COLUMNS = 256;
export const MAX_WORKSHEET_LOGICAL_CELLS = 1_000_000;
export const MAX_WORKBOOK_LOGICAL_CELLS = 2_000_000;
export const MAX_WORKSHEET_MERGES = 10_000;
export const MAX_WORKBOOK_MERGES = 20_000;
export const MAX_MERGE_LOGICAL_CELLS = 10_000;
export const MAX_WORKSHEET_MERGED_CELLS = 100_000;
export const MAX_WORKBOOK_MERGED_CELLS = 200_000;

export const WORKSHEET_METADATA_REJECTED_ERROR_CODE =
  'worksheet_metadata_rejected';
export const WORKSHEET_METADATA_REJECTED_MESSAGE =
  '표의 행, 열 또는 병합 범위가 너무 커서 읽지 않았어요.';

const MAX_NORMALIZED_REFERENCE_LENGTH = 64;

export interface SheetPoint {
  r: number;
  c: number;
}

export interface SheetRange {
  s: SheetPoint;
  e: SheetPoint;
}

export interface WorksheetMetadataSheet {
  readonly '!ref'?: unknown;
  readonly '!merges'?: unknown;
}

export interface WorksheetMetadataWorkbook {
  readonly SheetNames: readonly string[];
  readonly Sheets: Readonly<Record<string, WorksheetMetadataSheet | undefined>>;
}

export interface WorksheetMetadataTotals {
  logicalCells: number;
  mergeCount: number;
  mergedCells: number;
}

export interface WorkbookSheetMetadataTotals extends WorksheetMetadataTotals {
  sheetCount: number;
}

export type WorksheetMetadataRejectionReason =
  | 'workbook'
  | 'sheet-count'
  | 'reference'
  | 'dimensions'
  | 'logical-cells'
  | 'merge'
  | 'merge-count'
  | 'merge-cells'
  | 'workbook-logical-cells'
  | 'workbook-merge-count'
  | 'workbook-merged-cells';

export class WorksheetMetadataValidationError extends Error {
  readonly code = WORKSHEET_METADATA_REJECTED_ERROR_CODE;
  readonly reason: WorksheetMetadataRejectionReason;

  constructor(reason: WorksheetMetadataRejectionReason) {
    super(WORKSHEET_METADATA_REJECTED_MESSAGE);
    this.name = 'WorksheetMetadataValidationError';
    this.reason = reason;
  }
}

export interface SheetMergeSpan {
  readonly startColumn: number;
  readonly endColumn: number;
  readonly anchor: SheetPoint;
}

export interface ResolvedSheetCell {
  value: unknown;
  /** Stable identity for the source cell, used to suppress merged duplicates. */
  sourceKey: string;
  fromMerge: boolean;
}

export type SheetMergeIndex = ReadonlyMap<
  number,
  readonly SheetMergeSpan[]
>;

interface InspectedWorksheetMetadata extends WorksheetMetadataTotals {
  merges: readonly SheetRange[];
}

const keyFor = (row: number, column: number): string => `${row}:${column}`;

function reject(reason: WorksheetMetadataRejectionReason): never {
  throw new WorksheetMetadataValidationError(reason);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkedAdd(
  current: number,
  next: number,
  limit: number,
  reason: WorksheetMetadataRejectionReason,
): number {
  if (
    !Number.isSafeInteger(current)
    || !Number.isSafeInteger(next)
    || current < 0
    || next < 0
    || current > limit
    || next > limit - current
  ) {
    return reject(reason);
  }
  return current + next;
}

function checkedMultiply(
  left: number,
  right: number,
  limit: number,
  reason: WorksheetMetadataRejectionReason,
): number {
  if (
    !Number.isSafeInteger(left)
    || !Number.isSafeInteger(right)
    || left < 1
    || right < 1
    || left > Math.floor(limit / right)
  ) {
    return reject(reason);
  }
  return left * right;
}

function decodeSafeDecimal(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    const digit = value.charCodeAt(index) - 48;
    if (result > Math.floor((Number.MAX_SAFE_INTEGER - digit) / 10)) {
      return reject('reference');
    }
    result = (result * 10) + digit;
  }
  return result;
}

function decodeSafeColumn(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    const digit = value.charCodeAt(index) - 64;
    if (result > Math.floor((Number.MAX_SAFE_INTEGER - digit) / 26)) {
      return reject('reference');
    }
    result = (result * 26) + digit;
  }
  return result;
}

function decodeNormalizedSheetPoint(value: string): SheetPoint {
  const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(value);
  if (!match) return reject('reference');

  const columnText = match[1];
  const rowText = match[2];
  if (!columnText || !rowText) return reject('reference');

  const oneBasedColumn = decodeSafeColumn(columnText);
  const oneBasedRow = decodeSafeDecimal(rowText);
  if (
    !Number.isSafeInteger(oneBasedColumn)
    || !Number.isSafeInteger(oneBasedRow)
    || oneBasedColumn < 1
    || oneBasedRow < 1
  ) {
    return reject('reference');
  }
  return {
    r: oneBasedRow - 1,
    c: oneBasedColumn - 1,
  };
}

function decodeNormalizedSheetRange(value: string): SheetRange {
  if (
    value.length === 0
    || value.length > MAX_NORMALIZED_REFERENCE_LENGTH
  ) {
    return reject('reference');
  }

  const separator = value.indexOf(':');
  if (separator !== value.lastIndexOf(':')) return reject('reference');

  const start = decodeNormalizedSheetPoint(
    separator === -1 ? value : value.slice(0, separator),
  );
  const end = separator === -1
    ? start
    : decodeNormalizedSheetPoint(value.slice(separator + 1));

  if (end.r < start.r || end.c < start.c) return reject('reference');
  return { s: start, e: end };
}

function decodeMergePoint(value: unknown): SheetPoint {
  if (!isRecord(value)) return reject('merge');
  const row = value.r;
  const column = value.c;
  if (
    typeof row !== 'number'
    || typeof column !== 'number'
    || !Number.isFinite(row)
    || !Number.isFinite(column)
    || !Number.isSafeInteger(row)
    || !Number.isSafeInteger(column)
    || row < 0
    || column < 0
  ) {
    return reject('merge');
  }
  return { r: row, c: column };
}

function decodeMergeRange(value: unknown): SheetRange {
  if (!isRecord(value)) return reject('merge');
  const start = decodeMergePoint(value.s);
  const end = decodeMergePoint(value.e);
  if (end.r < start.r || end.c < start.c) return reject('merge');
  if (
    end.r >= MAX_WORKSHEET_ROWS
    || end.c >= MAX_WORKSHEET_COLUMNS
  ) {
    return reject('dimensions');
  }
  return { s: start, e: end };
}

function inspectWorksheetMetadata(
  sheet: WorksheetMetadataSheet,
): InspectedWorksheetMetadata {
  if (!isRecord(sheet)) return reject('workbook');

  const reference = sheet['!ref'];
  let logicalCells = 0;
  if (reference !== undefined) {
    if (typeof reference !== 'string') return reject('reference');
    const range = decodeNormalizedSheetRange(reference);
    if (
      range.e.r >= MAX_WORKSHEET_ROWS
      || range.e.c >= MAX_WORKSHEET_COLUMNS
    ) {
      return reject('dimensions');
    }
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    logicalCells = checkedMultiply(
      rowCount,
      columnCount,
      MAX_WORKSHEET_LOGICAL_CELLS,
      'logical-cells',
    );
  }

  const rawMerges = sheet['!merges'];
  if (rawMerges !== undefined && !Array.isArray(rawMerges)) {
    return reject('merge');
  }
  const mergeValues: readonly unknown[] = rawMerges ?? [];
  if (mergeValues.length > MAX_WORKSHEET_MERGES) {
    return reject('merge-count');
  }

  const merges: SheetRange[] = [];
  let mergedCells = 0;
  for (const value of mergeValues) {
    const merge = decodeMergeRange(value);
    const rowCount = merge.e.r - merge.s.r + 1;
    const columnCount = merge.e.c - merge.s.c + 1;
    const mergeCells = checkedMultiply(
      rowCount,
      columnCount,
      MAX_MERGE_LOGICAL_CELLS,
      'merge-cells',
    );
    mergedCells = checkedAdd(
      mergedCells,
      mergeCells,
      MAX_WORKSHEET_MERGED_CELLS,
      'merge-cells',
    );
    merges.push(merge);
  }

  return {
    logicalCells,
    mergeCount: merges.length,
    mergedCells,
    merges,
  };
}

/**
 * Validates one decoded sheet before any logical-table conversion.
 * Missing range metadata represents an empty sheet.
 */
export function validateWorksheetMetadata(
  sheet: WorksheetMetadataSheet,
): WorksheetMetadataTotals {
  const { logicalCells, mergeCount, mergedCells } =
    inspectWorksheetMetadata(sheet);
  return { logicalCells, mergeCount, mergedCells };
}

/** Validates every named sheet and the cumulative workbook totals. */
export function validateWorkbookSheetMetadata(
  workbook: WorksheetMetadataWorkbook,
): WorkbookSheetMetadataTotals {
  if (
    !isRecord(workbook)
    || !Array.isArray(workbook.SheetNames)
    || !isRecord(workbook.Sheets)
  ) {
    return reject('workbook');
  }
  if (workbook.SheetNames.length > MAX_WORKBOOK_SHEETS) {
    return reject('sheet-count');
  }

  let logicalCells = 0;
  let mergeCount = 0;
  let mergedCells = 0;
  for (const sheetName of workbook.SheetNames) {
    if (typeof sheetName !== 'string') return reject('workbook');
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return reject('workbook');
    const totals = validateWorksheetMetadata(sheet);
    logicalCells = checkedAdd(
      logicalCells,
      totals.logicalCells,
      MAX_WORKBOOK_LOGICAL_CELLS,
      'workbook-logical-cells',
    );
    mergeCount = checkedAdd(
      mergeCount,
      totals.mergeCount,
      MAX_WORKBOOK_MERGES,
      'workbook-merge-count',
    );
    mergedCells = checkedAdd(
      mergedCells,
      totals.mergedCells,
      MAX_WORKBOOK_MERGED_CELLS,
      'workbook-merged-cells',
    );
  }

  return {
    sheetCount: workbook.SheetNames.length,
    logicalCells,
    mergeCount,
    mergedCells,
  };
}

export function createSheetMergeIndex(
  merges: readonly SheetRange[] | undefined,
): SheetMergeIndex {
  const inspected = inspectWorksheetMetadata({ '!merges': merges });
  const index = new Map<number, SheetMergeSpan[]>();
  for (const merge of inspected.merges) {
    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      const spans = index.get(row);
      const span: SheetMergeSpan = {
        startColumn: merge.s.c,
        endColumn: merge.e.c,
        anchor: merge.s,
      };
      if (spans) {
        spans.push(span);
      } else {
        index.set(row, [span]);
      }
    }
  }
  return index;
}

export function isNonEmptySheetCell(value: unknown): boolean {
  return value !== '' && value != null && String(value).trim() !== '';
}

/**
 * Resolve a cell through SheetJS merge metadata. Ordinary blank cells stay
 * blank; only coordinates explicitly covered by a merge inherit its anchor.
 */
export function resolveSheetCell(
  rows: readonly unknown[][],
  row: number,
  column: number,
  merges: SheetMergeIndex,
): ResolvedSheetCell {
  const ownValue = rows[row]?.[column];
  const spans = merges.get(row);
  if (spans) {
    for (let index = spans.length - 1; index >= 0; index -= 1) {
      const span = spans[index];
      if (
        span
        && column >= span.startColumn
        && column <= span.endColumn
      ) {
        const value = rows[span.anchor.r]?.[span.anchor.c];
        return {
          value: value ?? '',
          sourceKey: keyFor(span.anchor.r, span.anchor.c),
          fromMerge: span.anchor.r !== row || span.anchor.c !== column,
        };
      }
    }
  }
  return {
    value: ownValue ?? '',
    sourceKey: keyFor(row, column),
    fromMerge: false,
  };
}
