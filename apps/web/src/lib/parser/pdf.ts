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

const DATE_PATTERN = /(?:\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일)/;
const AMOUNT_PATTERN = /[\d,]+원?/;
const STRICT_DATE_PATTERN = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/;
const SHORT_YEAR_DATE_PATTERN = /(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})/;
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/]\d{1,2}$/;
const STRICT_AMOUNT_PATTERN = /^-?[\d,]+원?$/;

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
import { parseDateStringToISO } from './date-utils.js';

function parseDateToISO(raw: string): string {
  return parseDateStringToISO(raw);
}

function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  // Return 0 instead of NaN so callers never have to guard against NaN
  // propagation. Amounts of 0 are correctly filtered out by the > 0
  // checks in both the structured and fallback parsing paths.
  return Number.isNaN(n) ? 0 : n;
}

function findDateCell(row: string[]): { idx: number; value: string } | null {
  for (let i = 0; i < row.length; i++) {
    const cell = row[i] ?? '';
    if (
      STRICT_DATE_PATTERN.test(cell) ||
      SHORT_YEAR_DATE_PATTERN.test(cell) ||
      KOREAN_FULL_DATE_PATTERN.test(cell) ||
      KOREAN_SHORT_DATE_PATTERN.test(cell) ||
      SHORT_MD_DATE_PATTERN.test(cell)
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

      // Skip zero-amount rows. When parseAmount returns 0 from a non-empty
      // input, the amount was unparseable — report an error to match the
      // CSV parser's behavior (which returns NaN and reports via isValidAmount).
      if (amount === 0) {
        const cleaned = amountRaw.replace(/원$/, '').replace(/,/g, '').trim();
        if (cleaned && !/^0+$/.test(cleaned)) {
          parseErrors.push({ message: `금액을 해석할 수 없습니다: ${amountRaw.trim()}` });
        }
        continue;
      }
      // Allow negative amounts (refund/cancellation entries).

      const tx: RawTransaction = {
        date: parseDateToISO(dateCell.value),
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
  } catch {
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
          // Allow non-zero amounts including negative (refund/cancellation entries)
          if (amount !== 0) {
            fallbackTransactions.push({
              date: parseDateToISO(dateMatch[1]!),
              merchant: between.replace(/\s+/g, ' ').trim(),
              amount,
            });
          } else {
            // If the raw value was non-empty and not just zeroes, report an
            // error — matching the structured path's behavior (C10-03/C11-03).
            const cleaned = amountRaw.replace(/원$/, '').replace(/,/g, '').trim();
            if (cleaned && !/^0+$/.test(cleaned)) {
              errors.push({ message: `금액을 해석할 수 없습니다: ${amountRaw.trim()}` });
            }
          }
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
