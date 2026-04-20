import type { BankAdapter, BankId, ParseError, ParseResult, RawTransaction } from './types.js';
import { detectBank, detectCSVDelimiter } from './detect.js';

// ---------------------------------------------------------------------------
// Shared helpers (used by all adapters)
// ---------------------------------------------------------------------------

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map((v) => v.trim());
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

/** Shared date-parsing — delegates to the canonical implementation in
 *  date-utils.ts to avoid triplicating the logic across parsers (C19-01). */
import { parseDateStringToISO } from './date-utils.js';

function parseDateToISO(raw: string): string {
  return parseDateStringToISO(raw);
}

function parseAmount(raw: string): number {
  let cleaned = raw.trim();
  // Handle (1,234) format for negative amounts
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) cleaned = cleaned.slice(1, -1);
  cleaned = cleaned.replace(/원$/, '').replace(/,/g, '').replace(/\s/g, '');
  // Use Math.round(parseFloat(...)) to match the xlsx parser's rounding behavior
  // (C21-03). Korean Won amounts are always integers, but formula-rendered CSV
  // cells may contain decimal remainders; rounding is more correct than truncation.
  const parsed = Math.round(parseFloat(cleaned));
  if (Number.isNaN(parsed)) return NaN;
  return isNegative ? -parsed : parsed;
}

/** Check if a parsed amount is valid (not NaN). Pushes an error and returns
 *  false if the amount is NaN, so the caller can skip the transaction. */
function isValidAmount(amount: number, amountRaw: string, lineIdx: number, errors: ParseError[]): boolean {
  if (Number.isNaN(amount)) {
    if (amountRaw.trim()) {
      errors.push({ line: lineIdx + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}` });
    }
    return false;
  }
  // Skip zero-amount rows (e.g., balance inquiries, declined transactions)
  // which don't contribute to spending optimization — matching the PDF
  // parser's behavior (pdf.ts:231-237). C26-02.
  if (amount === 0) return false;
  return true;
}

/** Parse an installment value from a CSV cell. Returns undefined for
 *  non-numeric values (e.g., "일시불" for lump-sum) which are common and
 *  expected — they mean no installment, not a parse error. Returns the
 *  installment count only when > 1. Extracted from 10 duplicated blocks
 *  across bank adapters (C24-01). */
function parseInstallments(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const inst = parseInt(raw, 10);
  if (Number.isNaN(inst)) return undefined; // "일시불" etc.
  return inst > 1 ? inst : undefined;
}

// ---------------------------------------------------------------------------
// Generic CSV parser
// ---------------------------------------------------------------------------

// NOTE: These patterns are used only for the isDateLike() column-detection
// heuristic in the generic CSV parser. They must be kept in sync with the
// date formats handled by parseDateStringToISO() in date-utils.ts. If a new
// date format is added there, add a corresponding pattern here.
const DATE_PATTERNS = [
  /^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}$/,      // 2024-01-15
  /^\d{2}[.\-\/]\d{2}[.\-\/]\d{2}$/,           // 24-01-15 (YY-MM-DD)
  /^\d{1,2}[.\-\/]\d{1,2}$/,                   // 01/15 (MM/DD)
  /^\d{4}\d{2}\d{2}$/,                          // 20240115
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/,         // 2024년 1월 15일
  /^\d{1,2}월\s*\d{1,2}일$/,                   // 1월 15일
];

const AMOUNT_PATTERNS = [
  /^-?[\d,]+원?$/,
  /^-?[\d,]+$/,       // Integer amounts only — Korean Won has no subunits
];

function isDateLike(value: string): boolean {
  return DATE_PATTERNS.some((p) => p.test(value.trim()));
}

function isAmountLike(value: string): boolean {
  return AMOUNT_PATTERNS.some((p) => p.test(value.trim()));
}

function parseGenericCSV(content: string, bank: BankId | null): ParseResult {
  const delimiter = detectCSVDelimiter(content);
  const lines = content.split('\n').filter((l) => l.trim());
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];

  if (lines.length === 0) {
    return { bank, format: 'csv', transactions: [], errors: [{ message: 'Empty file' }] };
  }

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const cells = splitLine(lines[i] ?? '', delimiter);
    const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
    if (hasNonNumeric) {
      headerIdx = i;
      break;
    }
  }

  const headers = splitLine(lines[headerIdx] ?? '', delimiter);

  let dateCol = -1;
  let merchantCol = -1;
  let amountCol = -1;
  let installmentsCol = -1;
  let categoryCol = -1;
  let memoCol = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] ?? '';
    // Date columns
    if (/이용일|거래일|날짜|일시|이용일자|거래일시|결제일|승인일|매출일/.test(h) && dateCol === -1) dateCol = i;
    // Merchant columns
    else if (/이용처|가맹점|상호|이용가맹점|가맹점명|거래처|매출처|사용처|결제처/.test(h) && merchantCol === -1) merchantCol = i;
    // Amount columns
    else if (/이용금액|거래금액|금액|결제금액|승인금액|매출금액|이용액|합계/.test(h) && amountCol === -1) amountCol = i;
    // Installments
    else if (/할부|할부개월|할부기간|할부월/.test(h) && installmentsCol === -1) installmentsCol = i;
    // Category
    else if (/업종|카테고리|분류|업종분류|업종명/.test(h) && categoryCol === -1) categoryCol = i;
    // Memo
    else if (/비고|적요|메모|내용|설명|참고/.test(h) && memoCol === -1) memoCol = i;
  }

  if (dateCol === -1 || merchantCol === -1 || amountCol === -1) {
    const sampleRows = lines.slice(headerIdx + 1, headerIdx + 5);
    for (const row of sampleRows) {
      const cells = splitLine(row, delimiter);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i] ?? '';
        if (dateCol === -1 && isDateLike(cell)) dateCol = i;
        else if (amountCol === -1 && isAmountLike(cell) && !isDateLike(cell)) amountCol = i;
      }
    }
    if (dateCol !== -1 && amountCol !== -1 && merchantCol === -1) {
      for (let i = 0; i < headers.length; i++) {
        if (i !== dateCol && i !== amountCol) {
          merchantCol = i;
          break;
        }
      }
    }
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;

    // Skip summary/total rows
    if (/합계|총계|소계|total|sum/i.test(line)) continue;

    const cells = splitLine(line, delimiter);

    const dateRaw = dateCol !== -1 ? (cells[dateCol] ?? '') : '';
    const merchantRaw = merchantCol !== -1 ? (cells[merchantCol] ?? '') : '';
    const amountRaw = amountCol !== -1 ? (cells[amountCol] ?? '') : '';

    if (!dateRaw && !merchantRaw && !amountRaw) continue;

    const amount = parseAmount(amountRaw);
    // Use the shared isValidAmount() helper which handles both NaN and
    // zero-amount filtering (C26-02), matching the bank-specific adapters.
    if (!isValidAmount(amount, amountRaw, i, errors)) continue;

    const tx: RawTransaction = {
      date: parseDateToISO(dateRaw),
      merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
      amount,
    };

    if (installmentsCol !== -1 && cells[installmentsCol]) {
      const inst = parseInstallments(cells[installmentsCol]);
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

// ---------------------------------------------------------------------------
// Bank adapters
// ---------------------------------------------------------------------------

const samsungAdapter: BankAdapter = {
  bankId: 'samsung',

  detect(content: string): boolean {
    return /삼성카드/.test(content) || /SAMSUNG\s*CARD/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      const hasDate = cells.includes('이용일');
      const hasMerchant = cells.includes('가맹점명');
      if (hasDate && hasMerchant) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'samsung', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('이용일');
    const merchantIdx = headers.indexOf('가맹점명');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부');
    const categoryIdx = headers.indexOf('업종');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'samsung', format: 'csv', transactions, errors };
  },
};

const shinhanAdapter: BankAdapter = {
  bankId: 'shinhan',

  detect(content: string): boolean {
    return /신한카드/.test(content) || /SHINHAN/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.includes('이용일') && cells.includes('이용처')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'shinhan', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('이용일');
    const merchantIdx = headers.indexOf('이용처');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부개월수');
    const categoryIdx = headers.indexOf('업종분류');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'shinhan', format: 'csv', transactions, errors };
  },
};

const kbAdapter: BankAdapter = {
  bankId: 'kb',

  detect(content: string): boolean {
    return /KB국민카드/.test(content) || /국민카드/.test(content) || /kbcard/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const KB_HEADERS = ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => KB_HEADERS.includes(c))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'kb', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('거래일시');
    const merchantIdx = headers.indexOf('가맹점명');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부개월');
    const categoryIdx = headers.indexOf('업종');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'kb', format: 'csv', transactions, errors };
  },
};

const hyundaiAdapter: BankAdapter = {
  bankId: 'hyundai',

  detect(content: string): boolean {
    return /현대카드/.test(content) || /HYUNDAICARD/.test(content) || /hdcard/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const HYUNDAI_HEADERS = ['이용일', '이용처', '이용금액', '할부', '비고'];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => HYUNDAI_HEADERS.includes(c))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'hyundai', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('이용일');
    const merchantIdx = headers.indexOf('이용처');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부');
    const memoIdx = headers.indexOf('비고');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'hyundai', format: 'csv', transactions, errors };
  },
};

const lotteAdapter: BankAdapter = {
  bankId: 'lotte',

  detect(content: string): boolean {
    return /롯데카드/.test(content) || /LOTTE\s*CARD/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.includes('거래일') && cells.includes('이용가맹점')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'lotte', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('거래일');
    const merchantIdx = headers.indexOf('이용가맹점');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부');
    const categoryIdx = headers.indexOf('업종');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'lotte', format: 'csv', transactions, errors };
  },
};

const hanaAdapter: BankAdapter = {
  bankId: 'hana',

  detect(content: string): boolean {
    return /하나카드/.test(content) || /HANA\s*CARD/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.includes('이용일자') && cells.includes('가맹점명')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'hana', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('이용일자');
    const merchantIdx = headers.indexOf('가맹점명');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부개월');
    const memoIdx = headers.indexOf('적요');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'hana', format: 'csv', transactions, errors };
  },
};

const wooriAdapter: BankAdapter = {
  bankId: 'woori',

  detect(content: string): boolean {
    return /우리카드/.test(content) || /wooricard/i.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const WOORI_HEADERS = ['이용일자', '이용가맹점', '이용금액', '할부기간', '비고'];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => WOORI_HEADERS.includes(c))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'woori', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('이용일자');
    const merchantIdx = headers.indexOf('이용가맹점');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부기간');
    const memoIdx = headers.indexOf('비고');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'woori', format: 'csv', transactions, errors };
  },
};

const nhAdapter: BankAdapter = {
  bankId: 'nh',

  detect(content: string): boolean {
    return /NH농협/.test(content) || /농협카드/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.includes('거래일') && cells.includes('이용처') && cells.includes('거래금액')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'nh', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('거래일');
    const merchantIdx = headers.indexOf('이용처');
    const amountIdx = headers.indexOf('거래금액');
    const installIdx = headers.indexOf('할부');
    const memoIdx = headers.indexOf('비고');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'nh', format: 'csv', transactions, errors };
  },
};

const ibkAdapter: BankAdapter = {
  bankId: 'ibk',

  detect(content: string): boolean {
    return /IBK기업은행/.test(content) || /기업은행/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];
    const IBK_HEADERS = ['거래일', '가맹점', '거래금액', '할부', '적요'];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => IBK_HEADERS.includes(c))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'ibk', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('거래일');
    const merchantIdx = headers.indexOf('가맹점');
    const amountIdx = headers.indexOf('거래금액');
    const installIdx = headers.indexOf('할부');
    const memoIdx = headers.indexOf('적요');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'ibk', format: 'csv', transactions, errors };
  },
};

const bcAdapter: BankAdapter = {
  bankId: 'bc',

  detect(content: string): boolean {
    return /BC카드/.test(content) || /비씨카드/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.includes('이용일') && cells.includes('가맹점') && cells.includes('이용금액')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'bc', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('이용일');
    const merchantIdx = headers.indexOf('가맹점');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부');
    const categoryIdx = headers.indexOf('업종');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (!isValidAmount(amount, amountRaw, i, errors)) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'bc', format: 'csv', transactions, errors };
  },
};

// ---------------------------------------------------------------------------
// Adapter registry & main parseCSV export
// ---------------------------------------------------------------------------

const ADAPTERS: BankAdapter[] = [
  hyundaiAdapter,
  kbAdapter,
  ibkAdapter,
  wooriAdapter,
  samsungAdapter,
  shinhanAdapter,
  lotteAdapter,
  hanaAdapter,
  nhAdapter,
  bcAdapter,
];

export function parseCSV(content: string, bank?: BankId): ParseResult {
  let resolvedBank: BankId | null = bank ?? null;

  if (!resolvedBank) {
    const { bank: detected } = detectBank(content);
    resolvedBank = detected;
  }

  // Try bank-specific adapter first
  if (resolvedBank) {
    const adapter = ADAPTERS.find((a) => a.bankId === resolvedBank);
    if (adapter?.parseCSV) {
      try {
        return adapter.parseCSV(content);
      } catch (err) {
        // Fall through to generic parser, but record the failure in the result
        // (matching the server-side pattern in packages/parser/src/csv/index.ts)
        const fallbackResult = parseGenericCSV(content, resolvedBank);
        fallbackResult.errors.unshift({
          message: `${adapter.bankId} 어댑터 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
        });
        return fallbackResult;
      }
    }
  }

  // Detect by content signature
  const signatureFailures: string[] = [];
  for (const adapter of ADAPTERS) {
    if (adapter.detect(content) && adapter.parseCSV) {
      try {
        return adapter.parseCSV(content);
      } catch (err) {
        const msg = `${adapter.bankId} 어댑터(자동 감지) 파싱 실패: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[cherrypicker] Bank adapter ${adapter.bankId} (detect) failed:`, err);
        signatureFailures.push(msg);
      }
    }
  }

  // Fall back to generic parser
  const result = parseGenericCSV(content, resolvedBank);
  // Collect any signature-detection adapter failures into the result
  for (const msg of signatureFailures) {
    result.errors.unshift({ message: msg });
  }
  return result;
}
