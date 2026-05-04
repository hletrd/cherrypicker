import type { BankId, ParseError, ParseResult, RawTransaction } from './types.js';
import { detectBank } from './detect.js';
import {
  normalizeHeader,
  findColumn,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  SUMMARY_ROW_PATTERN,
  HEADER_KEYWORDS,
  isValidHeaderRow,
} from './column-matcher.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Minimal representation of pdfjs-dist TextContent.items members.
 *  Defined locally because pdfjs-dist does not re-export these types
 *  from its main entry point. Matches the official TextItem / TextMarkedContent
 *  union — only `str` is accessed, so we narrow with `'str' in item`. */
type PdfTextItem = { str: string; dir: string; transform: unknown[]; width: number; height: number; hasEOL: boolean };
type PdfTextMarkedContent = { type: string; id: string };

// ---------------------------------------------------------------------------
// Table parser (ported from packages/parser/src/pdf/table-parser.ts)
// ---------------------------------------------------------------------------

// NOTE: The date/amount patterns below are used for PDF table row detection
// and fallback line scanning. They must be kept in sync with the date formats
// handled by parseDateStringToISO() in date-utils.ts. If a new date format is
// added there, update the DATE_PATTERN, STRICT_DATE_PATTERN, and related
// constants accordingly.
const DATE_PATTERN = /(?:\d{4}[.\-\/．。]\d{1,2}[.\-\/．。]\d{1,2}|\d{2}[.\-\/．。]\d{2}[.\-\/．。]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|(?<![.\d．。])\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．。])|(?<!\d)\d{8}(?!\d)|(?<!\d)\d{6}(?!\d))/;
// Korean amount pattern — excludes digit sequences adjacent to hyphens
// to prevent false positives from card numbers (1234-5678-9012-3456) and
// phone numbers (010-1234-5678) being matched as amounts (F5-01).
// C27-01: Bare integers without a comma or Won sign must be 5+ digits to
// avoid matching 4-digit year values like "2024" as amounts. Amounts with
// commas (e.g., "1,234") or Won signs (e.g., "₩500") always match.
// C32-01: Won-sign-prefixed amounts (₩/￦) match regardless of digit count,
// so small amounts like "₩500" are correctly detected as transaction amounts.
const AMOUNT_PATTERN = /(?<![a-zA-Z\d\-－])₩\d[\d,]*\s*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d\-－])￦\d[\d,]*\s*원?(?![a-zA-Z\d\-－])|마이너스[\d,]+\s*원?|(?<![a-zA-Z\d])KRW[\d,]+\s*원?(?![a-zA-Z\d])|(?<![a-zA-Z\d])\+[\d,]+\s*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d])(?:[\d,]*,|\d{5,})[\d,]*\s*원?(?![a-zA-Z\d\-－])|(?<![a-zA-Z\d])－[\d,]+\s*원?(?![a-zA-Z\d])|\([\d,]+\)|(?:[\d,]*,|\d{5,})[\d,]*-(?![a-zA-Z\d\-－])/;
const STRICT_DATE_PATTERN = /(\d{4})[.\-\/．。](\d{1,2})[.\-\/．。](\d{1,2})/;
const SHORT_YEAR_DATE_PATTERN = /(\d{2})[.\-\/．。](\d{2})[.\-\/．。](\d{2})/;
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/．。]\d{1,2}$/;

/** Validate that a SHORT_MD_DATE_PATTERN match has plausible month/day
 *  values using month-aware day limits. This prevents decimal amounts
 *  like "3.5" from being misidentified as MM.DD dates (C8-11), and
 *  also rejects impossible dates like "2/31" or "4/31".
 *  Uses daysInMonth() from date-utils.ts with current year for correct
 *  leap year handling (C44-01), matching the CSV parser's
 *  isDateLikeShort() approach which also uses daysInMonth(). */
function isValidShortDate(cell: string): boolean {
  // Strip trailing delimiters before matching — Korean bank exports may
  // append a period or slash to dates (e.g., "1.15." or "1/15/") (C57-01).
  const stripped = cell.replace(/[.\-\/．。]\s*$/, '');
  const match = stripped.match(SHORT_MD_DATE_PATTERN);
  if (!match) return false;
  const parts = stripped.split(/[.\-\/．。]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(new Date().getFullYear(), month);
}
// C27-01: Require either a comma (thousand separator) or minimum 5 digits
// for bare integers. Prevents 4-digit year values like "2024" from matching
// as amounts in findAmountCell and the fallback line scanner.
const STRICT_AMOUNT_PATTERN = /^마이너스[\d,]+\s*원?$|^KRW[\d,]+\s*원?$|^\+[\d,]+\s*원?$|^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*\s*원?$|^\([\d,]+\)$|(?:[\d,]*,|\d{5,})[\d,]*-$/i;

interface Column {
  start: number;
  end: number;
}

function detectColumnBoundaries(lines: string[]): Column[] {
  if (lines.length === 0) return [];

  const maxLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const charCount = new Array<number>(maxLen).fill(0);

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== ' ') charCount[i] = (charCount[i] ?? 0) + 1;
    }
  }

  const threshold = lines.length * 0.3;
  const boundaries: number[] = [0];

  for (let i = 1; i < maxLen - 1; i++) {
    const count = charCount[i] ?? 0;
    const prevCount = charCount[i - 1] ?? 0;

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

function splitByColumns(line: string, columns: Column[]): string[] {
  return columns.map((col) => line.slice(col.start, col.end).trim());
}

function parseTable(text: string): string[][] {
  const lines = text.split('\n');
  const result: string[][] = [];

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
      // Only break after 2+ consecutive blank lines — a single blank line
      // may be a gap within the table (e.g., between monthly groups in
      // Korean credit card PDFs), not the end of the table.
      if (consecutiveBlankLines >= 2 && tableLines.length > 3) break;
    }
  }

  if (tableLines.length === 0) {
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      if (cells.length > 1) result.push(cells);
    }
    return result;
  }

  const columns = detectColumnBoundaries(tableLines);

  if (columns.length <= 1) {
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

/** Validate that a cell contains a plausible date. 6-digit strings
 *  must pass YYMMDD validation (C50-01). Short dates (MM.DD) must be
 *  validated with month/day range checks via isValidShortDate to prevent
 *  decimal amounts like "3.5" from being misidentified as dates. Parity
 *  with server-side PDF parser's isValidDateCell in
 *  packages/parser/src/pdf/table-parser.ts (C75-02). */
function isValidDateCell(cell: string): boolean {
  // Strip trailing delimiters before matching — Korean bank exports may
  // append a period or slash to dates (e.g., "2024. 1. 15.") (C57-01).
  const trimmed = cell.trim().replace(/[.\-\/．。]\s*$/, '');
  if (/^\d{8}$/.test(trimmed)) return isValidYYYYMMDD(trimmed);  // YYYYMMDD (C81-01)
  if (/^\d{6}$/.test(trimmed)) return isValidYYMMDD(trimmed);
  // Short dates (MM.DD/MM/DD) must be validated with month/day range
  // checks via isValidShortDate, matching the server-side PDF parser
  // behavior. The DATE_PATTERN's short-date alternative uses a lookahead
  // but no end-anchor and no month/day validation, so it can false-positive
  // on cells like "13.01" (invalid month) or "3.5" (decimal amount) (C75-02).
  if (SHORT_MD_DATE_PATTERN.test(trimmed)) return isValidShortDate(trimmed);
  return DATE_PATTERN.test(trimmed);
}

function filterTransactionRows(rows: string[][]): string[][] {
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
interface PDFColumnLayout {
  dateCol: number;
  merchantCol: number;
  amountCol: number;
  installmentsCol: number;
  categoryCol: number;
  memoCol: number;
}

/**
 * Detect a header row in parsed PDF table rows using shared HEADER_KEYWORDS.
 * Scans the first `maxScan` rows for one containing a recognized header
 * keyword from at least 2 distinct categories (date, merchant, amount),
 * matching CSV/XLSX header detection via isValidHeaderRow() (C16-02).
 * Returns the row index, or -1 if none found.
 */
function detectHeaderRow(rows: string[][], maxScan: number = 15): number {
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    if (isValidHeaderRow(rows[i]!.map((c) => c.trim()))) return i;
  }
  return -1;
}

/**
 * Extract column layout from a detected header row. Uses shared
 * findColumn() from column-matcher.ts which handles combined-header
 * splitting on "/" and "|" (C50-02). Returns null if date and amount
 * columns are not found (C15-03).
 */
function getHeaderColumns(headerRow: string[]): PDFColumnLayout | null {
  const dateCol = findColumn(headerRow, undefined, DATE_COLUMN_PATTERN);
  const merchantCol = findColumn(headerRow, undefined, MERCHANT_COLUMN_PATTERN);
  const amountCol = findColumn(headerRow, undefined, AMOUNT_COLUMN_PATTERN);
  const installmentsCol = findColumn(headerRow, undefined, INSTALLMENTS_COLUMN_PATTERN);
  const categoryCol = findColumn(headerRow, undefined, CATEGORY_COLUMN_PATTERN);
  const memoCol = findColumn(headerRow, undefined, MEMO_COLUMN_PATTERN);

  if (dateCol === -1 || amountCol === -1) return null;
  return { dateCol, merchantCol, amountCol, installmentsCol, categoryCol, memoCol };
}

// ---------------------------------------------------------------------------
// Structured parser (ported from packages/parser/src/pdf/index.ts)
// ---------------------------------------------------------------------------

/** Shared date-parsing — delegates to the canonical implementation in
 *  date-utils.ts to avoid triplicating the logic across parsers (C19-01). */
import { parseDateStringToISO, isValidISODate, isValidYYMMDD, isValidYYYYMMDD, daysInMonth } from './date-utils.js';

function parseDateToISO(raw: string, errors?: ParseError[]): string {
  const result = parseDateStringToISO(raw);
  // Report unparseable dates as parse errors so users can see which
  // transactions have malformed dates (C71-04/C56-04).
  if (!isValidISODate(result) && raw.trim() && errors) {
    errors.push({ message: `날짜를 해석할 수 없습니다: ${raw.trim()}` });
  }
  return result;
}

/** Parse an amount string from PDF text. Returns null for unparseable inputs
 *  so callers can distinguish between genuinely zero amounts and parse failures,
 *  matching the CSV parser's isValidAmount() pattern (C33-03). */
function parseAmount(raw: string): number | null {
  let cleaned = raw
    .replace(/^\+/, '') // Strip leading + sign used by some banks for positive amounts (C66-02)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits -> ASCII
    .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-') // full-width comma/dot/minus -> ASCII
    .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
    .replace(/^KRW\s*/i, '') // ISO 4217 KRW currency prefix (C56-01)
    .replace(/\s*원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
  // Handle "마이너스" prefix — some Korean bank exports use this instead of
  // a negative sign or parentheses (parity with server-side parseCSVAmount
  // in packages/parser/src/csv/shared.ts C33-03).
  const isManeuners = /^마이너스/.test(cleaned);
  if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
  // Handle trailing minus sign — some Korean bank exports use "1,234-"
  // instead of "-1,234" for negative amounts (C68-01).
  const hasTrailingMinus = /\d-$/.test(cleaned);
  if (hasTrailingMinus) cleaned = cleaned.replace(/-$/, '');
  // Handle parenthesized negatives: (1,234) → -1234 (C36-01).
  const isNeg = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
  if (!cleaned.trim()) return null;
  // Use Math.round(parseFloat(...)) to match the csv.ts (C21-03) and xlsx.ts
  // (C20-01) parsers' rounding behavior. Korean Won amounts are always
  // integers, but PDF-extracted strings may contain decimal remainders from
  // formula cells; rounding is more correct than truncation.
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}

function findDateCell(row: string[]): { idx: number; value: string } | null {
  for (let i = 0; i < row.length; i++) {
    // Strip trailing delimiters before matching — Korean bank exports may
    // append a period or slash to dates (e.g., "2024. 1. 15.") (C57-01).
    const cell = (row[i] ?? '').replace(/[.\-\/．。]\s*$/, '');
    if (
      STRICT_DATE_PATTERN.test(cell) ||
      SHORT_YEAR_DATE_PATTERN.test(cell) ||
      KOREAN_FULL_DATE_PATTERN.test(cell) ||
      KOREAN_SHORT_DATE_PATTERN.test(cell) ||
      isValidShortDate(cell) ||
      isValidYYYYMMDD(cell)  // YYYYMMDD compact format (C81-01)
    ) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function findAmountCell(row: string[]): { idx: number; value: string } | null {
  for (let i = row.length - 1; i >= 0; i--) {
    if (STRICT_AMOUNT_PATTERN.test((row[i] ?? '').trim())) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function tryStructuredParse(text: string, _bank: BankId | null): { transactions: RawTransaction[]; errors: ParseError[] } | null {
  try {
    const rows = parseTable(text);
    const txRows = filterTransactionRows(rows);

    if (txRows.length === 0) return null;

    // Detect header row using shared HEADER_KEYWORDS for header-aware
    // column extraction (C15-03). This improves column identification
    // when PDFs have non-standard column ordering or extra columns.
    const headerIdx = detectHeaderRow(rows);
    const headerLayout = headerIdx !== -1 ? getHeaderColumns(rows[headerIdx]!) : null;

    const transactions: RawTransaction[] = [];
    const parseErrors: ParseError[] = [];

    for (const row of txRows) {
      // Skip summary/total rows that happen to have date+amount patterns
      const rowText = row.join(' ');
      if (SUMMARY_ROW_PATTERN.test(rowText)) continue;

      let dateIdx: number;
      let amountIdx: number;
      let merchantIdx: number;

      if (headerLayout) {
        dateIdx = headerLayout.dateCol;
        amountIdx = headerLayout.amountCol;
        merchantIdx = headerLayout.merchantCol;
      } else {
        const dateCell = findDateCell(row);
        const amountCell = findAmountCell(row);
        if (!dateCell || !amountCell) continue;
        dateIdx = dateCell.idx;
        amountIdx = amountCell.idx;
        merchantIdx = -1;
      }

      // Bounds check for header-based indices
      if (dateIdx >= row.length || amountIdx >= row.length) continue;

      const dateValue = (row[dateIdx] ?? '').trim();
      const amountValue = (row[amountIdx] ?? '').trim();

      // Validate header-detected positions against actual cell content;
      // fall back to positional heuristic per-row if they don't match.
      if (headerLayout) {
        const dateCell = findDateCell(row);
        const amountCell = findAmountCell(row);
        if (!dateCell || !amountCell) continue;
        if (dateCell.idx !== dateIdx) dateIdx = dateCell.idx;
        if (amountCell.idx !== amountIdx) amountIdx = amountCell.idx;
      }

      if (!dateValue || dateIdx === -1) continue;

      // Extract merchant: prefer header-detected column, then fall back
      // to the longest text cell between date and amount (C15-04).
      let merchant = '';
      if (merchantIdx >= 0 && merchantIdx < row.length) {
        merchant = (row[merchantIdx] ?? '').trim();
      }
      if (!merchant && dateIdx !== amountIdx) {
        // Find the longest text cell between date and amount.
        // Handles both normal (date < amount) and reversed (amount < date)
        // column orderings in PDF tables (C26-01).
        const lo = Math.min(dateIdx, amountIdx) + 1;
        const hi = Math.max(dateIdx, amountIdx);
        let bestIdx = -1;
        let bestLen = 0;
        for (let i = lo; i < hi; i++) {
          const cellText = (row[i] ?? '').trim();
          if (cellText.length > bestLen) {
            bestLen = cellText.length;
            bestIdx = i;
          }
        }
        if (bestIdx !== -1) {
          merchantIdx = bestIdx;
          merchant = (row[merchantIdx] ?? '').trim();
        }
      }
      // When date and amount are adjacent columns (no cells between them),
      // scan all non-date/amount cells for the longest Korean-text cell
      // as merchant candidate. This handles PDFs where merchant is in a
      // column before date or after amount (C46-01).
      if (!merchant) {
        const reserved = new Set([dateIdx, amountIdx]);
        if (merchantIdx >= 0) reserved.add(merchantIdx);
        let bestIdx = -1;
        let bestLen = 0;
        for (let i = 0; i < row.length; i++) {
          if (reserved.has(i)) continue;
          const cellText = (row[i] ?? '').trim();
          // Prefer cells with Korean characters (merchant names)
          if (cellText.length > bestLen && /[가-힣]/.test(cellText)) {
            bestLen = cellText.length;
            bestIdx = i;
          }
        }
        // Fallback: longest non-numeric text cell even without Korean
        if (bestIdx === -1) {
          for (let i = 0; i < row.length; i++) {
            if (reserved.has(i)) continue;
            const cellText = (row[i] ?? '').trim();
            if (cellText.length > bestLen && !/^\d[\d,.\-\/]*$/.test(cellText)) {
              bestLen = cellText.length;
              bestIdx = i;
            }
          }
        }
        if (bestIdx !== -1) {
          merchantIdx = bestIdx;
          merchant = (row[merchantIdx] ?? '').trim();
        }
      }

      const amount = parseAmount(amountValue);

      // parseAmount returns null for unparseable inputs — report an error
      // matching the CSV parser's isValidAmount() pattern (C33-03).
      if (amount === null) {
        const cleaned = amountValue.replace(/원$/, '').replace(/,/g, '').trim();
        if (cleaned && !/^0+$/.test(cleaned)) {
          parseErrors.push({ message: `금액을 해석할 수 없습니다: ${amountValue.trim()}` });
        }
        continue;
      }
      // Skip zero- and negative-amount rows (C42-01/C42-02).
      if (amount <= 0) continue;

      const tx: RawTransaction = {
        date: parseDateToISO((row[dateIdx] ?? '').trim(), parseErrors),
        merchant,
        amount,
      };

      // Extract category from header-detected column
      if (headerLayout && headerLayout.categoryCol >= 0 && headerLayout.categoryCol < row.length) {
        const catValue = (row[headerLayout.categoryCol] ?? '').trim();
        if (catValue) tx.category = catValue;
      }

      // Extract memo from header-detected column
      if (headerLayout && headerLayout.memoCol >= 0 && headerLayout.memoCol < row.length) {
        const memoValue = (row[headerLayout.memoCol] ?? '').trim();
        if (memoValue) tx.memo = memoValue;
      }

      // Look for installment info via header column or heuristic scan
      if (headerLayout && headerLayout.installmentsCol >= 0 && headerLayout.installmentsCol < row.length) {
        const instCell = (row[headerLayout.installmentsCol] ?? '').trim();
        const instMatch = instCell.match(/^(\d+)/);
        if (instMatch) {
          const inst = parseInt(instMatch[1] ?? '', 10);
          if (inst > 1) tx.installments = inst;
        }
      } else {
        for (let i = 0; i < row.length; i++) {
          if (i === dateIdx || i === amountIdx || i === merchantIdx) continue;
          const cell = (row[i] ?? '').trim();
          const instMatch = cell.match(/^(\d+)개?월?$/);
          if (instMatch) {
            const inst = parseInt(instMatch[1] ?? '', 10);
            if (inst > 1) tx.installments = inst;
          }
        }
      }

      transactions.push(tx);
    }

    return transactions.length > 0 ? { transactions, errors: parseErrors } : null;
  } catch (err) {
    // Log structured parse failure for diagnostics (C25-06/D-106).
    console.warn('[cherrypicker] Structured PDF table parse failed, falling back to line scan:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main PDF parser (browser: uses pdfjs-dist)
// ---------------------------------------------------------------------------

export async function parsePDF(buffer: ArrayBuffer, bank?: BankId): Promise<ParseResult> {
  const errors: ParseError[] = [];
  let text: string;

  // Extract text using pdfjs-dist (dynamic import to avoid SSR issues)
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Use a bundled same-origin worker instead of a remote CDN worker.
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Use Y-coordinate-based line break detection and X-position spacing
      // to preserve column alignment, matching the server-side extractor.ts
      // behavior (C14-03). This enables the structured table parser to work
      // in the browser instead of relying solely on the fallback line scanner.
      let lastY = -1;
      let lastEndX = -1;
      let pageText = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const transform = item.transform as number[];
        const y = transform[5] ?? 0;
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          pageText += '\n';
          lastEndX = -1;
        } else if (lastEndX !== -1 && item.str.length > 0) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = y;
        if (transform) {
          lastEndX = (transform[4] ?? 0) + item.str.length * 6;
        }
      }
      fullText += pageText + '\n';
    }
    text = fullText;
  } catch (err) {
    return {
      bank: bank ?? null,
      format: 'pdf',
      transactions: [],
      errors: [{ message: `PDF 텍스트 추출 실패: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  // Detect bank if not provided
  const resolvedBank: BankId | null = bank ?? detectBank(text).bank;

  // Try structured table parsing
  const structured = tryStructuredParse(text, resolvedBank);
  if (structured && structured.transactions.length > 0) {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: structured.transactions,
      errors: [...structured.errors, ...errors],
    };
  }

  // Fallback: scan every line for date + amount patterns
  const fallbackTransactions: RawTransaction[] = [];
  const lines = text.split('\n');
  const fallbackDatePattern = /(\d{4}[.\-\/．。]\d{1,2}[.\-\/．。]\d{1,2}|\d{2}[.\-\/．。]\d{2}[.\-\/．。]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．。])|(?<!\d)\d{8}(?!\d)|(?<!\d)\d{6}(?!\d))/;
  // The 'g' flag is required for matchAll() below. Do NOT hoist this regex
  // to module scope — the global flag's lastIndex mutation would break
  // .test()/.exec() calls if the regex were shared across invocations.
  // Match normal amounts, parenthesized negatives like (1,234), and
  // fullwidth-minus negatives like －50,000 (C58-01).
  // Parenthesized negatives are common in Korean bank statements for refunds
  // and should be treated as negative amounts by parseAmount() (C17-02).
  // C27-01: Exclude 4-digit years by requiring either a comma or 5+ digits
  // for bare integers. "2024" alone won't match; "1,234" and "10000" will.
  // Also matches "마이너스" prefixed amounts used by some Korean banks.
  const fallbackAmountPattern = /\(([\d,]+)\)|[₩￦]([\d,]+)원?|마이너스([\d,]+)원?|(－[\d,]+)원?|KRW([\d,]+)원?|([\d,]*(?:,|\d{5,})[\d,]*)-|([\d,]*(?:,|\d{5,})[\d,]*)원?/g;

  for (const line of lines) {
    const dateMatch = line.match(fallbackDatePattern);
    // Validate short dates (MM.DD) to prevent false positives from
    // decimal amounts like "3.5" or impossible dates like "2/31" (F7-01).
    if (dateMatch && SHORT_MD_DATE_PATTERN.test(dateMatch[0]) && !isValidShortDate(dateMatch[0])) {
      continue;
    }
    // Validate YYMMDD (6-digit compact dates) to prevent false positives
    // from transaction IDs matching the new fallback date pattern (C58-02).
    if (dateMatch && /^\d{6}$/.test(dateMatch[0]) && !isValidYYMMDD(dateMatch[0])) {
      continue;
    }
    // Validate YYYYMMDD (8-digit compact dates) to prevent false positives
    // from 8-digit numbers that are not valid dates (C81-01).
    if (dateMatch && /^\d{8}$/.test(dateMatch[0]) && !isValidYYYYMMDD(dateMatch[0])) {
      continue;
    }
    // Use the last amount match — Korean statements typically list the
    // transaction amount as the last numeric value on the line
    const amountMatches = [...line.matchAll(fallbackAmountPattern)];
    const amountMatch = amountMatches.length > 0 ? amountMatches[amountMatches.length - 1] : null;
    if (dateMatch && amountMatch) {
      // Extract merchant: everything between date and amount.
      // Handle both normal (date before amount) and reversed (amount before
      // date) column orderings in PDF tables (C60-02).
      const dateStart = line.indexOf(dateMatch[0]);
      const dateEnd = dateStart + dateMatch[0].length;
      const amountStart = line.lastIndexOf(amountMatch[0]);
      const amountEnd = amountStart + amountMatch[0].length;
      let between = '';
      if (amountStart > dateEnd) {
        between = line.slice(dateEnd, amountStart).trim();
      } else if (dateStart > amountEnd) {
        // Reversed column order: amount before date (C60-02)
        between = line.slice(amountEnd, dateStart).trim();
      }
      if (between) {
        const amountRaw = (amountMatch[1] ?? amountMatch[2] ?? amountMatch[3] ?? amountMatch[4] ?? amountMatch[5] ?? amountMatch[6] ?? amountMatch[7])!;
        const amount = parseAmount(amountRaw);
        // parseAmount returns null for unparseable inputs (C33-03).
        if (amount === null) {
          const cleaned = amountRaw.replace(/원$/, '').replace(/,/g, '').trim();
          if (cleaned && !/^0+$/.test(cleaned)) {
            errors.push({ message: `금액을 해석할 수 없습니다: ${amountRaw.trim()}` });
          }
          // Skip unparseable amounts
        } else if (amount > 0) {
          // Only include positive-amount transactions (C42-01).
          // Negative amounts (refunds) and zero amounts (balance inquiries)
          // don't contribute to spending optimization.
          fallbackTransactions.push({
            date: parseDateToISO(dateMatch[1]!, errors),
            merchant: between.replace(/\s+/g, ' ').trim(),
            amount,
          });
        }
        // amount <= 0: skip zero/negative-amount rows (balance inquiries, refunds)
      }
    }
  }

  if (fallbackTransactions.length > 0) {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: fallbackTransactions,
      errors,
    };
  }

  // No transactions found at all
  errors.push({ message: 'PDF에서 거래를 찾지 못했어요. CSV나 Excel 파일로 다시 시도해 보세요.' });

  return {
    bank: resolvedBank,
    format: 'pdf',
    transactions: [],
    errors,
  };
}
