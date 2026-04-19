import * as XLSX from 'xlsx';
import type { BankId, ParseError, ParseResult, RawTransaction } from './types.js';
import { detectBank } from './detect.js';

// ---------------------------------------------------------------------------
// Column config per bank (ported from packages/parser/src/xlsx/adapters)
// ---------------------------------------------------------------------------

interface ColumnConfig {
  date: string;
  merchant: string;
  amount: string;
  installments?: string;
  category?: string;
  memo?: string;
}

export const BANK_COLUMN_CONFIGS: Record<BankId, ColumnConfig> = {
  hyundai: {
    date: '이용일',
    merchant: '이용처',
    amount: '이용금액',
    installments: '할부',
    memo: '비고',
  },
  kb: {
    date: '거래일시',
    merchant: '가맹점명',
    amount: '이용금액',
    installments: '할부개월',
    category: '업종',
  },
  ibk: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
    memo: '적요',
  },
  woori: {
    date: '이용일자',
    merchant: '이용가맹점',
    amount: '이용금액',
    installments: '할부기간',
    memo: '비고',
  },
  samsung: {
    date: '이용일',
    merchant: '가맹점명',
    amount: '이용금액',
    installments: '할부',
    category: '업종',
  },
  shinhan: {
    date: '이용일',
    merchant: '이용처',
    amount: '이용금액',
    installments: '할부개월수',
    category: '업종분류',
  },
  lotte: {
    date: '거래일',
    merchant: '이용가맹점',
    amount: '이용금액',
    installments: '할부',
    category: '업종',
  },
  hana: {
    date: '이용일자',
    merchant: '가맹점명',
    amount: '이용금액',
    installments: '할부개월',
    memo: '적요',
  },
  nh: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
    installments: '할부',
    memo: '비고',
  },
  bc: {
    date: '이용일',
    merchant: '가맹점',
    amount: '이용금액',
    installments: '할부',
    category: '업종',
  },
  kakao: {
    date: '거래일시',
    merchant: '이용처',
    amount: '이용금액',
  },
  toss: {
    date: '거래일',
    merchant: '이용처',
    amount: '이용금액',
  },
  kbank: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
  },
  bnk: {
    date: '거래일',
    merchant: '가맹점',
    amount: '이용금액',
    installments: '할부',
  },
  dgb: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  suhyup: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  jb: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  kwangju: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  jeju: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  sc: {
    date: '거래일',
    merchant: '이용처',
    amount: '이용금액',
    installments: '할부',
  },
  mg: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  cu: {
    date: '거래일',
    merchant: '가맹점',
    amount: '거래금액',
    installments: '할부',
  },
  kdb: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
    installments: '할부',
  },
  epost: {
    date: '거래일',
    merchant: '이용처',
    amount: '거래금액',
    installments: '할부',
  },
};

function getBankColumnConfig(bankId: BankId): ColumnConfig {
  return BANK_COLUMN_CONFIGS[bankId];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function parseDateToISO(raw: unknown): string {
  if (typeof raw === 'number') {
    // Guard against NaN, Infinity, and numbers that are clearly NOT dates
    if (!Number.isFinite(raw) || raw < 1 || raw > 100000) return String(raw);
    // Excel serial date number
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) {
      const y = date.y.toString().padStart(4, '0');
      const m = date.m.toString().padStart(2, '0');
      const d = date.d.toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof raw === 'string') {
    const cleaned = raw.trim();

    // YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD — validate month/day ranges to
    // avoid producing invalid date strings from corrupted data (e.g., "2026/13/99").
    const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (fullMatch) {
      const month = parseInt(fullMatch[2]!, 10);
      const day = parseInt(fullMatch[3]!, 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
      }
    }

    // YYYYMMDD — validate month/day ranges to avoid producing invalid date
    // strings from corrupted data (e.g., "20261399" → "2026-13-99").
    if (/^\d{8}$/.test(cleaned)) {
      const month = parseInt(cleaned.slice(4, 6), 10);
      const day = parseInt(cleaned.slice(6, 8), 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
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

    // 2024년 1월 15일 — validate month/day ranges to avoid producing
    // invalid date strings from corrupted text (e.g., "2026년 99월 99일").
    const koreanFull = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanFull) {
      const month = parseInt(koreanFull[2]!, 10);
      const day = parseInt(koreanFull[3]!, 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${koreanFull[1]}-${koreanFull[2]!.padStart(2, '0')}-${koreanFull[3]!.padStart(2, '0')}`;
      }
    }

    // 1월 15일
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
    // Handles short dates in HTML-as-XLS files where Excel stores text
    // rather than serial date numbers (e.g., "01/15" for January 15th).
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
  return String(raw ?? '');
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    // Korean Won amounts must be integers — round to prevent decimal
    // values (e.g., from formula cells) from polluting reward math.
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  if (typeof raw === 'string') {
    let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNegative) cleaned = cleaned.slice(1, -1);
    if (!cleaned) return null;
    const parsed = parseInt(cleaned, 10);
    if (Number.isNaN(parsed)) return null;
    return isNegative ? -parsed : parsed;
  }
  return null;
}

function parseInstallments(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw > 1 ? raw : undefined;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return !Number.isNaN(n) && n > 1 ? n : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// HTML-as-XLS detection & normalization
// Korean card companies often export HTML tables with .xls extension.
// ---------------------------------------------------------------------------

function isHTMLContent(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder('utf-8').decode(buffer.slice(0, 512)).trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
}

/** Fix malformed closing tags like </td   > commonly found in Korean card exports */
function normalizeHTML(html: string): string {
  return html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>');
}

// ---------------------------------------------------------------------------
// Main XLSX parser (browser: accepts ArrayBuffer)
// ---------------------------------------------------------------------------

export function parseXLSX(buffer: ArrayBuffer, bank?: BankId): ParseResult {
  // Detect HTML-as-XLS (Korean card companies export HTML with .xls extension)
  let workbook: XLSX.WorkBook;
  let htmlBankHint: BankId | null = null;

  if (isHTMLContent(buffer)) {
    const html = normalizeHTML(new TextDecoder('utf-8').decode(buffer));
    htmlBankHint = detectBank(html).bank;
    const normalized = new TextEncoder().encode(html);
    workbook = XLSX.read(normalized, { type: 'array', cellDates: false });
  } else {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  }

  if (workbook.SheetNames.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트를 찾을 수 없습니다.' }] };
  }

  // Try all sheets, use the first one that yields transactions
  let bestResult: ParseResult | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const result = parseXLSXSheet(sheet, bank, htmlBankHint);
    if (result.transactions.length > 0) {
      return result; // Found transactions, use this sheet
    }
    if (!bestResult) bestResult = result; // Keep first sheet as fallback
  }

  return bestResult ?? { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트 데이터를 읽을 수 없습니다.' }] };
}

function parseXLSXSheet(sheet: XLSX.WorkSheet, bank?: BankId, htmlBankHint?: BankId | null): ParseResult {
  // Convert to 2D array
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  if (rows.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '빈 파일입니다.' }] };
  }

  // Detect bank from header rows if not provided
  let resolvedBank: BankId | null = bank ?? null;
  if (!resolvedBank) {
    if (htmlBankHint) {
      resolvedBank = htmlBankHint;
    } else {
      const headerText = rows
        .slice(0, 10)
        .map((r) => r.join(' '))
        .join(' ');
      const { bank: detected } = detectBank(headerText);
      resolvedBank = detected;
    }
  }

  // Find header row — first row with known column keywords
  let headerRowIdx = -1;
  let headers: string[] = [];

  const allHeaderKeywords = [
    '이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '매출일',
    '이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호',
    '이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액',
  ];

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i] ?? [];
    const rowStrings = row.map((c) => String(c ?? '').trim());
    const matchCount = rowStrings.filter((c) => allHeaderKeywords.includes(c)).length;
    if (matchCount >= 2) {
      headerRowIdx = i;
      headers = rowStrings;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      bank: resolvedBank,
      format: 'xlsx',
      transactions: [],
      errors: [{ message: '헤더 행을 찾을 수 없습니다.' }],
    };
  }

  // Get column config for this bank (or auto-detect from headers)
  const config = resolvedBank ? getBankColumnConfig(resolvedBank) : null;

  // Try bank-specific config name first; if not found, fall back to regex pattern
  const findCol = (configName: string | undefined, pattern: RegExp): number => {
    if (configName) {
      const idx = headers.indexOf(configName);
      if (idx !== -1) return idx;
    }
    return headers.findIndex((h) => pattern.test(h));
  };

  const dateCol = findCol(config?.date, /이용일|거래일|날짜|일시|이용일자|거래일시|결제일|승인일|매출일/);
  const merchantCol = findCol(config?.merchant, /이용처|가맹점|이용가맹점|가맹점명|거래처|매출처|사용처|결제처|상호/);
  const amountCol = findCol(config?.amount, /이용금액|거래금액|금액|결제금액|승인금액|매출금액|이용액/);
  const installCol = findCol(config?.installments, /할부|할부개월|할부기간|할부월/);
  const categoryCol = findCol(config?.category, /업종|분류|카테고리|업종분류|업종명/);
  const memoCol = findCol(config?.memo, /비고|적요|메모|내용|설명|참고/);

  const transactions: RawTransaction[] = [];
  const errors: ParseError[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) continue;

    // Skip summary/total rows
    const rowText = row.map((c) => String(c ?? '')).join(' ');
    if (/합계|총계|소계|total|sum/i.test(rowText)) continue;

    const dateRaw = dateCol !== -1 ? row[dateCol] : '';
    const merchantRaw = merchantCol !== -1 ? row[merchantCol] : '';
    const amountRaw = amountCol !== -1 ? row[amountCol] : '';

    if (!dateRaw && !merchantRaw) continue;

    const amount = parseAmount(amountRaw);
    if (amount === null) {
      if (String(amountRaw ?? '').trim()) {
        errors.push({
          line: i + 1,
          message: `금액을 해석할 수 없습니다: ${String(amountRaw)}`,
          raw: rowText,
        });
      }
      continue;
    }

    const tx: RawTransaction = {
      date: parseDateToISO(dateRaw),
      merchant: String(merchantRaw ?? '').replace(/^"(.*)"$/, '$1').trim(),
      amount,
      ...(installCol !== -1 && row[installCol]
        ? { installments: parseInstallments(row[installCol]) }
        : {}),
      ...(categoryCol !== -1 && row[categoryCol]
        ? { category: String(row[categoryCol]).trim() }
        : {}),
      ...(memoCol !== -1 && row[memoCol]
        ? { memo: String(row[memoCol]).trim() }
        : {}),
    };

    transactions.push(tx);
  }

  return { bank: resolvedBank, format: 'xlsx', transactions, errors };
}
