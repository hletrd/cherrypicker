// Korean date pattern — must cover all formats that parseDateToISO handles,
// matching the web-side implementation in apps/web/src/lib/parser/pdf.ts.
// Also accepts full-width dot (U+FF0E) and ideographic full stop (U+3002)
// which Korean bank PDFs occasionally use (C23-02, parity with web-side).
const DATE_PATTERN = /(?:\d{4}[.\-\/．。]\d{1,2}[.\-\/．。]\d{1,2}|\d{2}[.\-\/．。]\d{2}[.\-\/．。]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|(?<![.\d．。])\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．。])|(?<!\d)\d{6}(?!\d))/;
// Korean amount pattern — excludes digit sequences adjacent to hyphens
// to prevent false positives from card numbers (1234-5678-9012-3456) and
// phone numbers (010-1234-5678) being matched as amounts (F5-01).
// C27-01: Bare integers without a comma or Won sign must be 5+ digits to
// avoid matching 4-digit year values like "2024" as amounts. Amounts with
// commas (e.g., "1,234") or Won signs (e.g., "₩500") always match.
// C32-01: Won-sign-prefixed amounts (₩/￦) match regardless of digit count,
// so small amounts like "₩500" are correctly detected as transaction amounts.
const AMOUNT_PATTERN = /(?<![a-zA-Z\d\-－])₩\d[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d\-－])￦\d[\d,]*원?(?![a-zA-Z\d\-－])|마이너스[\d,]+원?|(?<![a-zA-Z\d])KRW[\d,]+원?(?![a-zA-Z\d])|(?<![a-zA-Z\d])(?:[\d,]*,|\d{5,})[\d,]*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d])－[\d,]+원?(?![a-zA-Z\d])|\([\d,]+\)|(?:[\d,]*,|\d{5,})[\d,]*-(?![a-zA-Z\d\-－])/;

// Import shared column patterns from the column-matcher module for
// header-aware column detection in PDF tables (C15-03).
import {
  normalizeHeader,
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  HEADER_KEYWORDS,
  isValidHeaderRow,
} from '../csv/column-matcher.js';
import { daysInMonth, isValidYYMMDD } from '../date-utils.js';

interface Column {
  start: number;
  end: number;
}

/**
 * Detect column boundaries from whitespace analysis across multiple lines.
 * Finds positions that are consistently whitespace (column separators).
 */
function detectColumnBoundaries(lines: string[]): Column[] {
  if (lines.length === 0) return [];

  const maxLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
  if (maxLen === 0) return [];
  // Count non-space characters at each position
  const charCount = new Array<number>(maxLen).fill(0);

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== ' ') charCount[i] = (charCount[i] ?? 0) + 1;
    }
  }

  // A column boundary is a position where most lines have a space
  const threshold = lines.length * 0.3;
  const boundaries: number[] = [0];

  for (let i = 1; i < maxLen - 1; i++) {
    const count = charCount[i] ?? 0;
    const prevCount = charCount[i - 1] ?? 0;

    // Transition from dense chars to sparse = column boundary
    if (prevCount > threshold && count <= threshold) {
      boundaries.push(i);
    }
  }
  boundaries.push(maxLen);

  const columns: Column[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] ?? 0;
    const end = boundaries[i + 1] ?? maxLen;
    if (end - start > 1) {
      columns.push({ start, end });
    }
  }

  return columns;
}

/**
 * Split a line into cells based on detected column boundaries.
 */
function splitByColumns(line: string, columns: Column[]): string[] {
  return columns.map((col) => line.slice(col.start, col.end).trim());
}

/**
 * Parse table structure from raw PDF text.
 * Returns a 2D array of cell values.
 */
export function parseTable(text: string): string[][] {
  const lines = text.split('\n');
  const result: string[][] = [];

  // Find lines that look like table rows (contain dates or amounts)
  const tableLines: string[] = [];
  let inTable = false;
  let consecutiveBlankLines = 0;

  for (const line of lines) {
    const hasDate = DATE_PATTERN.test(line);
    const hasAmount = AMOUNT_PATTERN.test(line);

    if (hasDate || hasAmount) {
      inTable = true;
      consecutiveBlankLines = 0;
    }

    if (inTable && line.trim()) {
      tableLines.push(line);
      consecutiveBlankLines = 0;
    } else if (inTable && !line.trim()) {
      consecutiveBlankLines++;
      // End of table: 2+ consecutive blank lines after content.
      // A single blank line may be a gap within the table (e.g., between
      // monthly groups in Korean credit card PDFs), not the end.
      if (consecutiveBlankLines >= 2 && tableLines.length > 3) break;
    }
  }

  if (tableLines.length === 0) {
    // Fall back: split all non-empty lines by whitespace clusters
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      if (cells.length > 1) result.push(cells);
    }
    return result;
  }

  // Detect column structure from table lines
  const columns = detectColumnBoundaries(tableLines);

  if (columns.length <= 1) {
    // Fall back to whitespace splitting
    for (const line of tableLines) {
      const cells = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      if (cells.length > 0) result.push(cells);
    }
    return result;
  }

  for (const line of tableLines) {
    const cells = splitByColumns(line, columns);
    if (cells.some((c) => c.length > 0)) {
      result.push(cells);
    }
  }

  return result;
}

/** Validate that a cell contains a plausible date value. Rejects
 *  6-digit strings that fail YYMMDD validation (transaction IDs,
 *  phone suffixes) while accepting valid compact dates like "240115".
 *  Non-6-digit cells that match DATE_PATTERN are accepted as-is
 *  (C50-01). */
function isValidDateCell(cell: string): boolean {
  // Strip trailing delimiters before matching — Korean bank exports may
  // append a period or slash to dates (e.g., "2024. 1. 15.") (C57-01).
  const trimmed = cell.trim().replace(/[.\-\/．。]\s*$/, '');
  if (/^\d{6}$/.test(trimmed)) return isValidYYMMDD(trimmed);
  return DATE_PATTERN.test(trimmed);
}

/**
 * Find rows in parsed table that look like transaction rows.
 * Validates 6-digit date cells through YYMMDD validation to reject
 * false positives from transaction IDs (C50-01).
 */
export function filterTransactionRows(rows: string[][]): string[][] {
  return rows.filter((row) => {
    const hasDate = row.some((cell) => isValidDateCell(cell));
    const hasAmount = row.some((cell) => AMOUNT_PATTERN.test(cell));
    return hasDate && hasAmount;
  });
}

/**
 * Detected column layout from a PDF header row.
 * Indices are -1 when a column is not found.
 */
export interface PDFColumnLayout {
  headerRowIdx: number;
  dateCol: number;
  merchantCol: number;
  amountCol: number;
  installmentsCol: number;
  categoryCol: number;
  memoCol: number;
}

/**
 * Detect a header row in parsed PDF table rows using the shared
 * HEADER_KEYWORDS vocabulary from column-matcher.ts. Scans the first
 * `maxScan` rows for one that contains at least one recognized header
 * keyword from at least 2 distinct categories (date, merchant, amount),
 * matching the CSV/XLSX parser behavior via isValidHeaderRow() (C16-02).
 * This prevents summary rows with only amount keywords from being
 * misidentified as header rows.
 *
 * Returns the row index, or -1 if no header row is found.
 */
export function detectHeaderRow(rows: string[][], maxScan: number = 15): number {
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    // Use isValidHeaderRow which requires keywords from 2+ categories,
    // matching CSV/XLSX header detection behavior (C16-02).
    if (isValidHeaderRow(rows[i]!.map((c) => c.trim()))) return i;
  }
  return -1;
}

/**
 * Extract column layout from a detected header row in a PDF table.
 * Uses shared findColumn() from column-matcher.ts which handles
 * combined-header splitting on "/" and "|" (C50-02), automatic
 * normalization, and regex pattern fallback. Returns null if the
 * header row doesn't contain date and amount columns.
 */
export function getHeaderColumns(headerRow: string[]): PDFColumnLayout | null {
  const dateCol = findColumn(headerRow, undefined, DATE_COLUMN_PATTERN);
  const merchantCol = findColumn(headerRow, undefined, MERCHANT_COLUMN_PATTERN);
  const amountCol = findColumn(headerRow, undefined, AMOUNT_COLUMN_PATTERN);
  const installmentsCol = findColumn(headerRow, undefined, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headerRow, undefined, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headerRow, undefined, MEMO_COLUMN_PATTERN);

  // Need at least date and amount columns for meaningful extraction
  if (dateCol === -1 || amountCol === -1) return null;

  // If merchant column not found, leave it as -1 — the caller will
  // fall back to positional heuristics for merchant extraction.
  return { headerRowIdx: -1, dateCol, merchantCol, amountCol, installmentsCol, categoryCol, memoCol };
}
