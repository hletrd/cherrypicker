// Korean date pattern — must cover all formats that parseDateToISO handles,
// matching the web-side implementation in apps/web/src/lib/parser/pdf.ts.
const DATE_PATTERN = /(?:\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|(?<![.\d])\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d]))/;
// Korean amount pattern — excludes digit sequences adjacent to hyphens
// to prevent false positives from card numbers (1234-5678-9012-3456) and
// phone numbers (010-1234-5678) being matched as amounts (F5-01).
const AMOUNT_PATTERN = /(?<![a-zA-Z\d-])[₩￦]?[\d,]+원?(?![a-zA-Z\d-])|\([\d,]+\)/;

// Import shared column patterns from the column-matcher module for
// header-aware column detection in PDF tables (C15-03).
import {
  normalizeHeader,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  HEADER_KEYWORDS,
} from '../csv/column-matcher.js';

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

/**
 * Find rows in parsed table that look like transaction rows.
 */
export function filterTransactionRows(rows: string[][]): string[][] {
  return rows.filter((row) => {
    const hasDate = row.some((cell) => DATE_PATTERN.test(cell));
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
}

/**
 * Detect a header row in parsed PDF table rows using the shared
 * HEADER_KEYWORDS vocabulary from column-matcher.ts. Scans the first
 * `maxScan` rows for one that contains at least one recognized header
 * keyword. Returns the row index, or -1 if no header row is found.
 *
 * This enables the PDF parser to use header-aware column extraction
 * instead of relying solely on positional heuristics (C15-03).
 */
export function detectHeaderRow(rows: string[][], maxScan: number = 15): number {
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const normalized = rows[i]!.map((c) => normalizeHeader(c).toLowerCase());
    const hasKeyword = normalized.some((c) => (HEADER_KEYWORDS as string[]).includes(c));
    if (hasKeyword) return i;
  }
  return -1;
}

/**
 * Extract column layout from a detected header row in a PDF table.
 * Uses the shared column patterns from column-matcher.ts to identify
 * which columns contain dates, merchants, amounts, and installments.
 * Returns null if the header row doesn't contain enough columns.
 */
export function getHeaderColumns(headerRow: string[]): PDFColumnLayout | null {
  const normalized = headerRow.map((c) => normalizeHeader(c));
  let dateCol = -1;
  let merchantCol = -1;
  let amountCol = -1;
  let installmentsCol = -1;

  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i]!;
    if (dateCol === -1 && DATE_COLUMN_PATTERN.test(h)) dateCol = i;
    else if (merchantCol === -1 && MERCHANT_COLUMN_PATTERN.test(h)) merchantCol = i;
    else if (amountCol === -1 && AMOUNT_COLUMN_PATTERN.test(h)) amountCol = i;
    else if (installmentsCol === -1 && INSTALLMENTS_COLUMN_PATTERN.test(h)) installmentsCol = i;
  }

  // Need at least date and amount columns for meaningful extraction
  if (dateCol === -1 || amountCol === -1) return null;

  // If merchant column not found, leave it as -1 — the caller will
  // fall back to positional heuristics for merchant extraction.
  return { headerRowIdx: -1, dateCol, merchantCol, amountCol, installmentsCol };
}
