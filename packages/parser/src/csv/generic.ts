import type { BankId, ParseError, ParseResult, RawTransaction } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO } from '../date-utils.js';
import { splitCSVLine, parseCSVAmount, parseCSVInstallments } from './shared.js';
import {
  normalizeHeader,
  DATE_COLUMN_PATTERN,
  MERCHANT_COLUMN_PATTERN,
  AMOUNT_COLUMN_PATTERN,
  INSTALLMENTS_COLUMN_PATTERN,
  CATEGORY_COLUMN_PATTERN,
  MEMO_COLUMN_PATTERN,
  HEADER_KEYWORDS,
  isValidHeaderRow,
} from './column-matcher.js';

// Korean date patterns — must cover all formats that parseDateStringToISO
// handles. Kept in sync with the web-side DATE_PATTERNS (C1-01).
const DATE_PATTERNS = [
  /^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}$/,      // 2024-01-15, 2024.1.5
  /^\d{2}[.\-\/]\d{2}[.\-\/]\d{2}$/,           // 24-01-15 (YY-MM-DD)
  /^\d{1,2}[.\-\/]\d{1,2}$/,                   // 01/15, 1.5 (MM/DD)
  /^\d{4}\d{2}\d{2}$/,                          // 20240115
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,         // 2024년 1월 15일
  /^\d{1,2}월\s*\d{1,2}일$/,                   // 1월 15일
];

// Korean amount patterns
const AMOUNT_PATTERNS = [
  /^-?[\d,]+원?$/,     // 1,234원 or 1,234 or -1,234
  /^-?[\d,]+$/,        // Integer amounts only — Korean Won has no subunits
];

function isDateLike(value: string): boolean {
  return DATE_PATTERNS.some((p) => p.test(value.trim()));
}

function isAmountLike(value: string): boolean {
  return AMOUNT_PATTERNS.some((p) => p.test(value.trim()));
}

// Use shared parseDateStringToISO from date-utils.ts for date parsing.
// The local parseDateToISO was removed in favor of the centralized
// implementation to avoid divergence (C35-03).

export function parseGenericCSV(content: string, bank: BankId | null): ParseResult {
  const delimiter = detectCSVDelimiter(content);
  const lines = content.split('\n').filter((l) => l.trim());
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (lines.length === 0) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: 'Empty file' }] };
  }

  // Find header row — scan up to 30 rows for Korean bank exports that have
  // long metadata preambles (bank name, statement period, card number).
  // A valid header row must contain at least one known header keyword AND
  // keywords from at least 2 distinct categories (date, merchant, amount)
  // to avoid matching summary rows that only have amount keywords (C1-01).
  // Uses shared isValidHeaderRow from column-matcher (C4-07).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = splitCSVLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric && isValidHeaderRow(cells.map((c) => c.trim()))) {
      headerIdx = i;
      break;
    }
  }

  // No valid header row found — return error instead of defaulting to row 0
  if (headerIdx === -1) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
  }

  const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);

  // Identify column roles
  let dateCol = -1;
  let merchantCol = -1;
  let amountCol = -1;
  let installmentsCol = -1;
  let categoryCol = -1;
  let memoCol = -1;

  // First pass: look for header keywords — use shared ColumnMatcher patterns
  // for maximum flexibility and consistency with the adapter-factory and XLSX
  // parser. Uses normalizeHeader() to tolerate whitespace and parenthetical
  // suffixes in column names.
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i] ?? '');
    if (DATE_COLUMN_PATTERN.test(h) && dateCol === -1) dateCol = i;
    else if (MERCHANT_COLUMN_PATTERN.test(h) && merchantCol === -1) merchantCol = i;
    else if (AMOUNT_COLUMN_PATTERN.test(h) && amountCol === -1) amountCol = i;
    else if (INSTALLMENTS_COLUMN_PATTERN.test(h) && installmentsCol === -1) installmentsCol = i;
    else if (CATEGORY_COLUMN_PATTERN.test(h) && categoryCol === -1) categoryCol = i;
    else if (MEMO_COLUMN_PATTERN.test(h) && memoCol === -1) memoCol = i;
  }

  // Second pass: infer from data if headers didn't match
  if (dateCol === -1 || merchantCol === -1 || amountCol === -1) {
    const sampleRows = lines.slice(headerIdx + 1, headerIdx + 5);
    for (const row of sampleRows) {
      const cells = splitCSVLine(row, delimiter);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] ?? '';
        if (dateCol === -1 && isDateLike(cell)) dateCol = i;
        else if (amountCol === -1 && isAmountLike(cell) && !isDateLike(cell)) amountCol = i;
      }
    }
    // Merchant is likely a text-heavy column containing Korean characters.
    // Prefer the first column (not date/amount/installments/category/memo)
    // where sample data contains Korean text (C4-03). This avoids picking
    // numeric columns like installments or card number suffixes.
    if (dateCol !== -1 && amountCol !== -1 && merchantCol === -1) {
      for (let i = 0; i < headers.length; i++) {
        if (i !== dateCol && i !== amountCol && i !== installmentsCol && i !== categoryCol && i !== memoCol) {
          // Check if any sample data in this column contains Korean characters
          const hasKorean = sampleRows.some((row) => {
            const cells = splitCSVLine(row, delimiter);
            return /[가-힣]/.test(cells[i] ?? '');
          });
          if (hasKorean) {
            merchantCol = i;
            break;
          }
        }
      }
      // Fallback: pick the first non-reserved column even without Korean
      if (merchantCol === -1) {
        for (let i = 0; i < headers.length; i++) {
          if (i !== dateCol && i !== amountCol && i !== installmentsCol && i !== categoryCol && i !== memoCol) {
            merchantCol = i;
            break;
          }
        }
      }
    }
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    // Skip summary/total rows
    if (/합계|총계|소계|total|sum/i.test(line)) continue;

    const cells = splitCSVLine(line, delimiter);

    const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
    const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
    const amountRaw = amountCol !== -1 ? (cells[amountCol] ?? '') : '';

    if (!dateRaw && !merchantRaw && !amountRaw) continue;

    const amount = parseCSVAmount(amountRaw);
    if (amount === null) {
      if (amountRaw.trim()) {
        errors.push({ line: i + 1, message: `Cannot parse amount: ${amountRaw}`, raw: line });
      }
      continue;
    }
    // Skip zero-amount rows (e.g., balance inquiries, declined transactions)
    // Skip zero- and negative-amount rows (e.g., balance inquiries, declined
    // transactions, refunds). These don't contribute to spending optimization
    // and would inflate monthly spending totals (C42-01/C42-02).
    if (amount <= 0) continue;

    const tx: RawTransaction = {
      date: parseDateStringToISO(dateRaw),
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installmentsCol !== -1 && cells[installmentsCol]) {
      const inst = parseCSVInstallments(cells[installmentsCol]);
      if (inst !== undefined) tx.installments = inst;
    }

    if (categoryCol !== -1 && cells[categoryCol]) {
      tx.category = cells[categoryCol];
    }

    if (memoCol !== -1 && cells[memoCol]) {
      tx.memo = cells[memoCol];
    }

    transactions.push(tx);
  }

  return { bank, format: 'csv', transactions, errors };
}
