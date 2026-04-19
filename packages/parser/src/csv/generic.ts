import type { BankId, ParseError, ParseResult, RawTransaction } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';

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

function isMerchantLike(header: string): boolean {
  const merchantKeywords = ['가맹점', '이용처', '상호', '업체', '가게', '상점', 'merchant', '이용가맹점'];
  return merchantKeywords.some((k) => header.includes(k));
}

/** Infer the year for a short-date (month/day only) using a look-back
 *  heuristic: if the date would be more than 3 months in the future,
 *  assume it belongs to the previous year. */
function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}

function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();

  // YYYYMMDD — validate month/day ranges to avoid producing invalid date
  // strings from corrupted data (e.g., "20261399" → "2026-13-99").
  if (/^\d{8}$/.test(cleaned)) {
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }

  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD (allow single-digit month/day)
  // Validate month/day ranges to avoid producing invalid date strings from
  // corrupted data (e.g., "2026/13/99").
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})/);
  if (fullMatch) {
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }

  // YY-MM-DD or YY.MM.DD — validate month/day ranges to avoid producing
  // invalid date strings from corrupted data (e.g., "99/13/99").
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

  // Korean: 2025년 11월 30일 — validate month/day ranges to avoid producing
  // invalid date strings from corrupted text (e.g., "2026년 99월 99일").
  const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanFull) {
    const month = parseInt(koreanFull[2]!, 10);
    const day = parseInt(koreanFull[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
    }
  }

  // MM/DD or MM.DD — infer year with look-back heuristic
  // Validate month/day ranges to avoid producing invalid date strings from
  // misidentified non-date columns (e.g., "13/45" would produce "2026-13-45").
  const shortMatch = cleaned.match(/^(\d{1,2})[.\-\/](\d{1,2})$/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1]!, 10);
    const day = parseInt(shortMatch[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = inferYear(month, day);
      return `${year}-${shortMatch[1]!.padStart(2, '0')}-${shortMatch[2]!.padStart(2, '0')}`;
    }
  }

  // Korean short: 1월 15일 — validate month/day ranges to avoid producing
  // invalid date strings from corrupted text (e.g., "99월 99일").
  const koreanShort = cleaned.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanShort) {
    const month = parseInt(koreanShort[1]!, 10);
    const day = parseInt(koreanShort[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = inferYear(month, day);
      return `${year}-${koreanShort[1]!.padStart(2, '0')}-${koreanShort[2]!.padStart(2, '0')}`;
    }
  }

  return cleaned;
}

function parseAmount(raw: string): number | null {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
}

function splitCSVLine(line: string, delimiter: string): string[] {
  if (delimiter === ',') {
    // Handle quoted fields for comma-separated
    const result: string[] = [];
    let inQuotes = false;
    let current = '';
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
  return line.split(delimiter).map((v) => v.trim());
}

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

    const amount = parseAmount(amountRaw);
    if (amount === null) {
      if (amountRaw.trim()) {
        errors.push({ line: i + 1, message: `Cannot parse amount: ${amountRaw}`, raw: line });
      }
      continue;
    }

    const tx: RawTransaction = {
      date: parseDateToISO(dateRaw),
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installmentsCol !== -1 && cells[installmentsCol]) {
      const inst = parseInt(cells[installmentsCol] ?? '', 10);
      if (!isNaN(inst) && inst > 1) tx.installments = inst;
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
