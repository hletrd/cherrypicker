import type { BankId, ParseError, ParseResult, RawTransaction } from './types.js';
import { detectBank } from './detect.js';
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
const DATE_PATTERN = /(?:\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|(?<![.\d])\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d]))/;
// Korean amount pattern — excludes digit sequences adjacent to hyphens
// to prevent false positives from card numbers (1234-5678-9012-3456) and
// phone numbers (010-1234-5678) being matched as amounts (F5-01).
const AMOUNT_PATTERN = /(?<![a-zA-Z\d-])[₩￦]?[\d,]+원?(?![a-zA-Z\d-])|\([\d,]+\)/;
const STRICT_DATE_PATTERN = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/;
const SHORT_YEAR_DATE_PATTERN = /(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})/;
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/]\d{1,2}$/;

/** Maximum days per month for a non-leap year, indexed 1-12.
 *  Used by isValidShortDate for month-aware day validation when no
 *  year context is available (C65-01). */
const MAX_DAYS_PER_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Validate that a SHORT_MD_DATE_PATTERN match has plausible month/day
 *  values using month-aware day limits (non-leap year). This prevents
 *  decimal amounts like "3.5" from being misidentified as MM.DD dates
 *  (C8-11), and also rejects impossible dates like "2/31" or "4/31"
 *  that would pass the old `day <= 31` check but be rejected by the
 *  production parseDateStringToISO() which uses isValidDayForMonth
 *  (C65-01). Note: Feb 29 is rejected here (non-leap year table) but
 *  Feb 29 dates in credit card statements always appear in full-year
 *  format (e.g., "2024-02-29") which matches STRICT_DATE_PATTERN or
 *  KOREAN_FULL_DATE_PATTERN before this function is called. */
function isValidShortDate(cell: string): boolean {
  const match = cell.match(SHORT_MD_DATE_PATTERN);
  if (!match) return false;
  const parts = cell.split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= (MAX_DAYS_PER_MONTH[month] ?? 0);
}
const STRICT_AMOUNT_PATTERN = /^[₩￦]?-?[\d,]+원?$|^\([\d,]+\)$/;

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

function filterTransactionRows(rows: string[][]): string[][] {
  return rows.filter((row) => {
    const hasDate = row.some((cell) => DATE_PATTERN.test(cell));
    const hasAmount = row.some((cell) => AMOUNT_PATTERN.test(cell));
    return hasDate && hasAmount;
  });
}

// ---------------------------------------------------------------------------
// Structured parser (ported from packages/parser/src/pdf/index.ts)
// ---------------------------------------------------------------------------

/** Shared date-parsing — delegates to the canonical implementation in
 *  date-utils.ts to avoid triplicating the logic across parsers (C19-01). */
import { parseDateStringToISO, isValidISODate } from './date-utils.js';

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
  let cleaned = raw.replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '');
  // Handle parenthesized negatives: (1,234) → -1234 (C36-01).
  // All other parsers (web CSV/XLSX, server CSV/XLSX/PDF) handle this format;
  // the web PDF parser was the only one missing it.
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
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
    const cell = row[i] ?? '';
    if (
      STRICT_DATE_PATTERN.test(cell) ||
      SHORT_YEAR_DATE_PATTERN.test(cell) ||
      KOREAN_FULL_DATE_PATTERN.test(cell) ||
      KOREAN_SHORT_DATE_PATTERN.test(cell) ||
      isValidShortDate(cell)
    ) return { idx: i, value: cell };
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

    const transactions: RawTransaction[] = [];
    const parseErrors: ParseError[] = [];

    for (const row of txRows) {
      const dateCell = findDateCell(row);
      const amountCell = findAmountCell(row);

      if (!dateCell || !amountCell) continue;

      let merchantIdx = -1;
      for (let i = dateCell.idx + 1; i < amountCell.idx; i++) {
        if ((row[i] ?? '').trim()) {
          merchantIdx = i;
          break;
        }
      }

      const merchant = merchantIdx !== -1 ? (row[merchantIdx] ?? '').trim() : '';
      const amountRaw = amountCell.value;
      const amount = parseAmount(amountRaw);

      // parseAmount returns null for unparseable inputs — report an error
      // matching the CSV parser's isValidAmount() pattern (C33-03).
      if (amount === null) {
        const cleaned = amountRaw.replace(/원$/, '').replace(/,/g, '').trim();
        if (cleaned && !/^0+$/.test(cleaned)) {
          parseErrors.push({ message: `금액을 해석할 수 없습니다: ${amountRaw.trim()}` });
        }
        continue;
      }
      // Skip zero- and negative-amount rows (e.g., balance inquiries, declined
      // transactions, refunds). These don't contribute to spending optimization
      // and would inflate monthly spending totals via Math.abs() downstream
      // (C42-01/C42-02).
      if (amount <= 0) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateCell.value, parseErrors),
        merchant,
        amount,
      };

      for (let i = 0; i < row.length; i++) {
        if (i === dateCell.idx || i === amountCell.idx || i === merchantIdx) continue;
        const cell = (row[i] ?? '').trim();
        const instMatch = cell.match(/^(\d+)개?월?$/);
        if (instMatch) {
          const inst = parseInt(instMatch[1] ?? '', 10);
          if (inst > 1) tx.installments = inst;
        }
      }

      transactions.push(tx);
    }

    return transactions.length > 0 ? { transactions, errors: parseErrors } : null;
  } catch (err) {
    // Log structured parse failure for diagnostics — the fallback line scanner
    // will still attempt recovery, but the structured parse failure should be
    // visible in the console for debugging malformed PDFs (C25-06/D-106).
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
      const pageText = content.items
        .map((item: PdfTextItem | PdfTextMarkedContent) => ('str' in item ? item.str : ''))
        .join(' ');
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
  const fallbackDatePattern = /(\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d]))/;
  // The 'g' flag is required for matchAll() below. Do NOT hoist this regex
  // to module scope — the global flag's lastIndex mutation would break
  // .test()/.exec() calls if the regex were shared across invocations.
  const fallbackAmountPattern = /([\d,]+)원?/g;

  for (const line of lines) {
    const dateMatch = line.match(fallbackDatePattern);
    // Validate short dates (MM.DD) to prevent false positives from
    // decimal amounts like "3.5" or impossible dates like "2/31" (F7-01).
    if (dateMatch && SHORT_MD_DATE_PATTERN.test(dateMatch[0]) && !isValidShortDate(dateMatch[0])) {
      continue;
    }
    // Use the last amount match — Korean statements typically list the
    // transaction amount as the last numeric value on the line
    const amountMatches = [...line.matchAll(fallbackAmountPattern)];
    const amountMatch = amountMatches.length > 0 ? amountMatches[amountMatches.length - 1] : null;
    if (dateMatch && amountMatch) {
      // Extract merchant: everything between date and amount
      const dateEnd = line.indexOf(dateMatch[0]) + dateMatch[0].length;
      const amountStart = line.lastIndexOf(amountMatch[0]);
      if (amountStart > dateEnd) {
        const between = line.slice(dateEnd, amountStart).trim();
        if (between) {
          const amountRaw = amountMatch[1]!;
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
