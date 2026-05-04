import type { BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { parseDateStringToISO, isValidISODate, daysInMonth, isValidYYMMDD } from '../date-utils.js';
import { extractText } from './extractor.js';
import { parseTable, filterTransactionRows, detectHeaderRow, getHeaderColumns } from './table-parser.js';
import { SUMMARY_ROW_PATTERN } from '../csv/column-matcher.js';
import { parsePDFWithLLM } from './llm-fallback.js';

export interface PDFParseOptions {
  allowRemoteLLM?: boolean;
}

// Date patterns for findDateCell — must cover all formats that parseDateStringToISO
// handles, matching the web-side implementation in apps/web/src/lib/parser/pdf.ts.
const STRICT_DATE_PATTERN = /(\d{4})[.\-\/．。](\d{1,2})[.\-\/．。](\d{1,2})/;
const SHORT_YEAR_DATE_PATTERN = /(\d{2})[.\-\/．。](\d{2})[.\-\/．。](\d{2})/;
const KOREAN_FULL_DATE_PATTERN = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const KOREAN_SHORT_DATE_PATTERN = /\d{1,2}월\s*\d{1,2}일/;
const SHORT_MD_DATE_PATTERN = /^\d{1,2}[.\-\/．。]\d{1,2}$/;
// C27-01: Require either a comma (thousand separator) or minimum 5 digits
// for bare integers. Prevents 4-digit year values like "2024" from matching
// as amounts in findAmountCell and the fallback line scanner.
const AMOUNT_PATTERN = /^[₩￦]\d[\d,]*원?$|^마이너스[\d,]+원?$|^KRW[\d,]+원?$|^\+[\d,]+원?$|^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*원?$|^\([\d,]+\)$|(?:[\d,]*,|\d{5,})[\d,]*-$/i;
// STRICT_AMOUNT_PATTERN — used by findAmountCell() for structured PDF parsing.
// Stricter than AMOUNT_PATTERN: requires digits after Won sign prefix so bare
// "₩" doesn't match, and includes KRW/마이너스 alternatives for parity with
// the web-side pdf.ts STRICT_AMOUNT_PATTERN (C63-01).
const STRICT_AMOUNT_PATTERN = /^마이너스[\d,]+원?$|^KRW[\d,]+원?$|^\+[\d,]+원?$|^[₩￦]?[－-]?(?:[\d,]*,|\d{5,})[\d,]*원?$|^\([\d,]+\)$|(?:[\d,]*,|\d{5,})[\d,]*-$/i;

/** Validate that a SHORT_MD_DATE_PATTERN match has plausible month/day
 *  values using month-aware day limits. This prevents decimal amounts
 *  like "3.5" from being misidentified as MM.DD dates (C8-11/C34-03),
 *  and also rejects impossible dates like "2/31" or "4/31".
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

// Date string parsing delegated to shared parseDateStringToISO from
// date-utils.ts to avoid divergence (C35-03).

/** Parse an amount string from PDF text. Returns null for unparseable inputs
 *  so callers can distinguish between genuinely zero amounts and parse failures,
 *  matching the CSV parser's isValidAmount() pattern (C33-03/C34-01). */
function parseAmount(raw: string): number | null {
  let cleaned = raw
    .replace(/^\+/, '') // Strip leading + sign used by some banks for positive amounts (C66-02)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48)) // full-width digits -> ASCII
    .replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-') // full-width comma/dot/minus -> ASCII
    .replace(/（/g, '(').replace(/）/g, ')') // full-width parentheses -> ASCII
    .replace(/^KRW\s*/i, '') // ISO 4217 KRW currency prefix (C56-01)
    .replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '');
  // Handle "마이너스" prefix — some Korean bank exports use this instead of
  // a negative sign or parentheses. Parity with web-side parseAmount
  // (apps/web/src/lib/parser/pdf.ts) and CSV shared parseCSVAmount.
  const isManeuners = /^마이너스/.test(cleaned);
  if (isManeuners) cleaned = cleaned.replace(/^마이너스/, '');
  // Handle trailing minus sign — some Korean bank exports use "1,234-"
  // instead of "-1,234" for negative amounts (C68-01).
  const hasTrailingMinus = /\d-$/.test(cleaned);
  if (hasTrailingMinus) cleaned = cleaned.replace(/-$/, '');
  const hasParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  const isNeg = hasParens || isManeuners || hasTrailingMinus;
  if (hasParens) cleaned = cleaned.slice(1, -1);
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
    // Strip trailing delimiters before matching — Korean bank exports may
    // append a period or slash to dates (e.g., "2024. 1. 15.") (C57-01).
    const cell = (row[i] ?? '').replace(/[.\-\/．。]\s*$/, '');
    if (
      STRICT_DATE_PATTERN.test(cell) ||
      SHORT_YEAR_DATE_PATTERN.test(cell) ||
      KOREAN_FULL_DATE_PATTERN.test(cell) ||
      KOREAN_SHORT_DATE_PATTERN.test(cell) ||
      isValidShortDate(cell)
    ) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function findAmountCell(row: string[]): { idx: number; value: string } | null {
  for (let i = row.length - 1; i >= 0; i--) {
    // Use STRICT_AMOUNT_PATTERN (not AMOUNT_PATTERN) for structured extraction
    // to avoid matching bare "₩" without digits (C63-01, parity with web-side).
    if (STRICT_AMOUNT_PATTERN.test((row[i] ?? '').trim())) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function tryStructuredParse(text: string, bank: BankId | null): { transactions: RawTransaction[]; errors: ParseError[] } | null {
  try {
    const rows = parseTable(text);
    const txRows = filterTransactionRows(rows);

    if (txRows.length === 0) return null;

    // Detect header row using shared HEADER_KEYWORDS for header-aware
    // column extraction (C15-03). This improves column identification
    // when PDFs have non-standard column ordering or extra columns
    // (e.g., category, card type) between date and amount columns.
    const headerIdx = detectHeaderRow(rows);
    let headerLayout = headerIdx !== -1 ? getHeaderColumns(rows[headerIdx]!) : null;

    const transactions: RawTransaction[] = [];
    const parseErrors: ParseError[] = [];

    for (const row of txRows) {
      // Skip summary/total rows that happen to have date+amount patterns
      const rowText = row.join(' ');
      if (SUMMARY_ROW_PATTERN.test(rowText)) continue;

      // Use header-aware column positions when available, falling back
      // to positional heuristics for PDFs without recognizable headers.
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

      // Bounds check — header-based indices may be out of range for
      // rows with fewer columns than the header.
      if (dateIdx >= row.length || amountIdx >= row.length) continue;

      const dateValue = (row[dateIdx] ?? '').trim();
      const amountValue = (row[amountIdx] ?? '').trim();

      // Validate that the cells at the header-detected positions actually
      // contain date and amount patterns. If not, fall back to positional
      // heuristics for this specific row (the header may have been
      // misidentified or the row may have a different structure).
      if (headerLayout) {
        const dateCell = findDateCell(row);
        const amountCell = findAmountCell(row);
        if (!dateCell || !amountCell) continue;
        // If the header-based column doesn't match the actual date/amount
        // position, use the positional heuristic for this row.
        if (dateCell.idx !== dateIdx) dateIdx = dateCell.idx;
        if (amountCell.idx !== amountIdx) amountIdx = amountCell.idx;
      }

      if (!dateValue || dateIdx === -1) continue;

      // Extract merchant
      let merchant = '';
      if (merchantIdx >= 0 && merchantIdx < row.length) {
        merchant = (row[merchantIdx] ?? '').trim();
      }
      // Fallback: if no merchant from header or header column is empty,
      // use the cell between date and amount (positional heuristic).
      if (!merchant && dateIdx !== amountIdx) {
        // Find the longest text cell between date and amount — this is
        // more likely to be the merchant name than the first non-empty
        // cell, which might be a short category label (C15-04).
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

      // parseAmount returns null for unparseable inputs — report error
      // and skip, matching web-side tryStructuredParse behavior (C39-01).
      if (amount === null) {
        const cleaned = amountValue.replace(/원$/, '').replace(/,/g, '').trim();
        if (cleaned && !/^0+$/.test(cleaned)) {
          parseErrors.push({ message: `금액을 해석할 수 없습니다: ${amountValue.trim()}` });
        }
        continue;
      }
      if (amount <= 0) continue;

      const dateStr = parseDateStringToISO((row[dateIdx] ?? '').trim());
      // Report unparseable dates as parse errors, matching web-side behavior
      // (C39-01). All other parsers report malformed dates.
      if (!isValidISODate(dateStr) && (row[dateIdx] ?? '').trim()) {
        parseErrors.push({ message: `날짜를 해석할 수 없습니다: ${(row[dateIdx] ?? '').trim()}` });
      }

      const tx: RawTransaction = {
        date: dateStr,
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

      // Look for installment info in remaining cells or header-detected column
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
    // Log structured parse failure for diagnostics — the fallback line scanner
    // will still attempt recovery, but the structured parse failure should be
    // visible in the console for debugging malformed PDFs.
    // Catch all errors and return null to allow fallback, matching web-side
    // behavior in apps/web/src/lib/parser/pdf.ts (C25-06).
    console.warn('[cherrypicker] Structured PDF table parse failed, falling back to line scan:', err instanceof Error ? err.message : String(err));
    return null;
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
  if (structured && structured.transactions.length > 0) {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: structured.transactions,
      errors: [...structured.errors, ...errors],
    };
  }

  // Tier 2.5: Fallback line scanner — scan every line for date + amount
  // patterns when structured table parsing fails (C34-04/C69). Ported from
  // the web-side parser (apps/web/src/lib/parser/pdf.ts) which has had this
  // fallback since initial implementation.
  const fallbackTransactions: RawTransaction[] = [];
  const lines = text.split('\n');
  const fallbackDatePattern = /(\d{4}[.\-\/．。]\d{1,2}[.\-\/．。]\d{1,2}|\d{2}[.\-\/．。]\d{2}[.\-\/．。]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일|\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．。])|(?<!\d)\d{6}(?!\d))/;
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
    // Full-format dates (YYYY.MM.DD, Korean) don't need this check since
    // they have explicit year context and are validated by parseDateStringToISO.
    if (dateMatch && SHORT_MD_DATE_PATTERN.test(dateMatch[0]) && !isValidShortDate(dateMatch[0])) {
      continue;
    }
    // Validate YYMMDD (6-digit compact dates) to prevent false positives
    // from transaction IDs matching the new fallback date pattern (C58-02).
    if (dateMatch && /^\d{6}$/.test(dateMatch[0]) && !isValidYYMMDD(dateMatch[0])) {
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
        // parseAmount returns null for unparseable inputs — skip the row
        // rather than silently treating it as 0 (C34-01).
        if (amount === null) {
          const cleaned = amountRaw.replace(/원$/, '').replace(/,/g, '').trim();
          if (cleaned && !/^0+$/.test(cleaned)) {
            errors.push({ message: `금액을 해석할 수 없습니다: ${amountRaw.trim()}` });
          }
        } else if (amount > 0) {
          // Only include positive-amount transactions (C42-01).
          // Negative amounts (refunds) and zero amounts (balance inquiries)
          // don't contribute to spending optimization.
          const fallbackDate = parseDateStringToISO(dateMatch[1]!);
          // Report unparseable dates as parse errors, matching web-side
          // fallback scanner behavior (C39-01).
          if (!isValidISODate(fallbackDate) && dateMatch[1]!.trim()) {
            errors.push({ message: `날짜를 해석할 수 없습니다: ${dateMatch[1]!.trim()}` });
          }
          fallbackTransactions.push({
            date: fallbackDate,
            merchant: between.replace(/\s+/g, ' ').trim(),
            amount,
          });
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
