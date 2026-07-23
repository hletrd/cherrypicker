export interface SheetPoint {
  r: number;
  c: number;
}

export interface SheetRange {
  s: SheetPoint;
  e: SheetPoint;
}

export interface ResolvedSheetCell {
  value: unknown;
  /** Stable identity for the source cell, used to suppress merged duplicates. */
  sourceKey: string;
  fromMerge: boolean;
}

export type SheetMergeIndex = ReadonlyMap<string, SheetPoint>;

const keyFor = (row: number, column: number): string => `${row}:${column}`;

export function createSheetMergeIndex(merges: readonly SheetRange[] | undefined): SheetMergeIndex {
  const index = new Map<string, SheetPoint>();
  for (const merge of merges ?? []) {
    for (let row = merge.s.r; row <= merge.e.r; row++) {
      for (let column = merge.s.c; column <= merge.e.c; column++) {
        index.set(keyFor(row, column), merge.s);
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
  const anchor = merges.get(keyFor(row, column));
  if (!anchor) {
    return { value: ownValue ?? '', sourceKey: keyFor(row, column), fromMerge: false };
  }
  const value = rows[anchor.r]?.[anchor.c];
  return {
    value: value ?? '',
    sourceKey: keyFor(anchor.r, anchor.c),
    fromMerge: anchor.r !== row || anchor.c !== column,
  };
}
