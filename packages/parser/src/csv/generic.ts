import type { BankId, ParseError, ParseResult, RawTransaction } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO } from '../date-utils.js';
import { splitCSVLine, parseCSVAmount, parseCSVInstallments } from './shared.js';

// Korean date patterns
const DATE_PATTERNS = [
  /^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}$/,  // YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD
  /^\d{2}[.\-\/]\d{2}$/,               // MM/DD or MM.DD
  /^\d{4}\d{2}\d{2}$/,                  // YYYYMMDD
];

// Korean amount patterns
const AMOUNT_PATTERNS = [
  /^-?[\d,]+원?$/,     // 1,234원 or 1,234 or -1,234
  /^-?[\d,]+\.?\d*$/,  // decimal amounts
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

  // Find header row — first line that isn't all numbers
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const cells = splitCSVLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric) {
      headerIdx = i;
      break;
    }
  }

  const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);

  // Identify column roles
  let dateCol = -1;
  let merchantCol = -1;
  let amountCol = -1;
  let installmentsCol = -1;
  let categoryCol = -1;
  let memoCol = -1;

  // First pass: look for header keywords
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] ?? '';
    if (/이용일|거래일|날짜|일시/.test(h) && dateCol === -1) dateCol = i;
    else if (/이용처|가맹점|상호|이용가맹점/.test(h) && merchantCol === -1) merchantCol = i;
    else if (/이용금액|거래금액|금액/.test(h) && amountCol === -1) amountCol = i;
    else if (/할부/.test(h) && installmentsCol === -1) installmentsCol = i;
    else if (/업종|카테고리|분류/.test(h) && categoryCol === -1) categoryCol = i;
    else if (/비고|적요|메모/.test(h) && memoCol === -1) memoCol = i;
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
    // Merchant is likely the column between date and amount
    if (dateCol !== -1 && amountCol !== -1 && merchantCol === -1) {
      for (let i = 0; i < headers.length; i++) {
        if (i !== dateCol && i !== amountCol) {
          merchantCol = i;
          break;
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
    // which don't contribute to spending optimization — matching the web-side
    // parser's isValidAmount() behavior (C26-02/C32-02).
    if (amount === 0) continue;

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
