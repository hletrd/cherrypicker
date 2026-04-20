import type { BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { inferYear } from '../date-utils.js';
import { extractText } from './extractor.js';
import { parseTable, filterTransactionRows } from './table-parser.js';
import { parsePDFWithLLM } from './llm-fallback.js';

export interface PDFParseOptions {
  allowRemoteLLM?: boolean;
}

// Date patterns for findDateCell — must cover all formats that parseDateToISO
// handles, matching the web-side implementation in apps/web/src/lib/parser/pdf.ts.
const STRICT_DATE_PATTERN = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/;
const SHORT_YEAR_DATE_PATTERN = /(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})/;
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/]\d{1,2}$/;
const AMOUNT_PATTERN = /^-?[\d,]+원?$/;

/** Validate that a SHORT_MD_DATE_PATTERN match has plausible month/day
 *  values (month 1-12, day 1-31). This prevents decimal amounts like
 *  "3.5" from being misidentified as MM.DD dates (C8-11/C34-03). */
function isValidShortDate(cell: string): boolean {
  const match = cell.match(SHORT_MD_DATE_PATTERN);
  if (!match) return false;
  const parts = cell.split(/[.\-\/]/);
  const month = parseInt(parts[0] ?? '', 10);
  const day = parseInt(parts[1] ?? '', 10);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();

  // YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD — validate month/day ranges to
  // avoid producing invalid date strings from corrupted data.
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (fullMatch) {
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }

  // YYYYMMDD — validate month/day ranges
  if (/^\d{8}$/.test(cleaned)) {
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }

  // YY-MM-DD or YY.MM.DD — validate month/day ranges
  const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]!, 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    const month = parseInt(shortYearMatch[2]!, 10);
    const day = parseInt(shortYearMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
    }
  }

  // Korean: 2025년 11월 30일 — validate month/day ranges
  const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanFull) {
    const month = parseInt(koreanFull[2]!, 10);
    const day = parseInt(koreanFull[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
    }
  }

  // Korean short: 1월 15일 — infer year with look-back heuristic
  const koreanShort = cleaned.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanShort) {
    const month = parseInt(koreanShort[1]!, 10);
    const day = parseInt(koreanShort[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = inferYear(month, day);
      return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
    }
  }

  // MM/DD or MM.DD — infer year with look-back heuristic
  const mdMatch = cleaned.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1]!, 10);
    const day = parseInt(mdMatch[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = inferYear(month, day);
      return `${year}-${mdMatch[1]!.padStart(2, '0')}-${mdMatch[2]!.padStart(2, '0')}`;
    }
  }

  return cleaned;
}

/** Parse an amount string from PDF text. Returns null for unparseable inputs
 *  so callers can distinguish between genuinely zero amounts and parse failures,
 *  matching the CSV parser's isValidAmount() pattern (C33-03/C34-01). */
function parseAmount(raw: string): number | null {
  let cleaned = raw.replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned.trim()) return null;
  // Use Math.round(parseFloat(...)) to match the web-side parser's rounding
  // behavior (C21-03/C32-01). Korean Won amounts are always integers, but
  // PDF-extracted strings may contain decimal remainders from formula cells;
  // rounding is more correct than truncation via parseInt (C34-01).
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
    if (AMOUNT_PATTERN.test((row[i] ?? '').trim())) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function tryStructuredParse(text: string, bank: BankId | null): RawTransaction[] | null {
  try {
    const rows = parseTable(text);
    const txRows = filterTransactionRows(rows);

    if (txRows.length === 0) return null;

    const transactions: RawTransaction[] = [];

    for (const row of txRows) {
      const dateCell = findDateCell(row);
      const amountCell = findAmountCell(row);

      if (!dateCell || !amountCell) continue;

      // Merchant is the cell between date and amount (or the largest non-date, non-amount cell)
      let merchantIdx = -1;
      for (let i = dateCell.idx + 1; i < amountCell.idx; i++) {
        if ((row[i] ?? '').trim()) {
          merchantIdx = i;
          break;
        }
      }

      const merchant = merchantIdx !== -1 ? (row[merchantIdx] ?? '').trim() : '';
      const amount = parseAmount(amountCell.value);

      // parseAmount returns null for unparseable inputs — skip the row
      // rather than silently treating it as 0 (C34-01).
      if (amount === null) continue;
      if (amount <= 0) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateCell.value),
        merchant,
        amount,
      };

      // Look for installment info in remaining cells
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

    return transactions.length > 0 ? transactions : null;
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof TypeError || err instanceof RangeError) {
      return null;
    }
    throw err;
  }
}

export async function parsePDF(
  filePath: string,
  bank?: BankId,
  options: PDFParseOptions = {},
): Promise<ParseResult> {
  const errors: ParseError[] = [];
  let text: string;

  // Tier 1: Extract text
  try {
    text = await extractText(filePath);
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

  // Tier 2: Try structured table parsing
  const structured = tryStructuredParse(text, resolvedBank);
  if (structured && structured.length > 0) {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: structured,
      errors,
    };
  }

  if (!options.allowRemoteLLM) {
    errors.push({
      message:
        '구조화된 PDF 파싱에 실패했습니다. 원격 LLM 폴백은 기본적으로 비활성화되어 있습니다. 명시적으로 허용하려면 --allow-remote-llm 플래그를 사용하세요.',
    });
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: [],
      errors,
    };
  }

  errors.push({ message: '구조화된 파싱 실패, 명시적으로 허용된 LLM 폴백을 시도합니다...' });

  // Tier 3: LLM fallback
  try {
    const llmTransactions = await parsePDFWithLLM(text);
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: llmTransactions,
      errors,
    };
  } catch (err) {
    errors.push({
      message: `LLM 폴백 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: [],
      errors,
    };
  }
}
