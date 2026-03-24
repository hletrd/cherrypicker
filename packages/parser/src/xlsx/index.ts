import { readFile } from 'fs/promises';
import type { BankId, ParseResult } from '../types.js';
import { detectBank } from '../detect.js';
import { getBankColumnConfig, type ColumnConfig } from './adapters/index.js';

// SheetJS is imported as a CommonJS module
import xlsx from 'xlsx';

function parseDateToISO(raw: unknown): string {
  if (typeof raw === 'number') {
    // Excel serial date number
    const date = xlsx.SSF.parse_date_code(raw);
    if (date) {
      const y = date.y.toString().padStart(4, '0');
      const m = date.m.toString().padStart(2, '0');
      const d = date.d.toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof raw === 'string') {
    const cleaned = raw.trim();
    const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
    if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`;
    if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    return cleaned;
  }
  return String(raw ?? '');
}

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.abs(raw);
  if (typeof raw === 'string') {
    return parseInt(raw.trim().replace(/원$/, '').replace(/,/g, ''), 10) || 0;
  }
  return 0;
}

function parseInstallments(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw > 1 ? raw : undefined;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return !isNaN(n) && n > 1 ? n : undefined;
  }
  return undefined;
}

export async function parseXLSX(filePath: string, bank?: BankId): Promise<ParseResult> {
  const buffer = await readFile(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트를 찾을 수 없습니다.' }] };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '시트 데이터를 읽을 수 없습니다.' }] };
  }

  // Convert to 2D array
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  if (rows.length === 0) {
    return { bank: bank ?? null, format: 'xlsx', transactions: [], errors: [{ message: '빈 파일입니다.' }] };
  }

  // Detect bank from header rows if not provided
  let resolvedBank: BankId | null = bank ?? null;
  if (!resolvedBank) {
    // Concatenate first few rows to text for bank detection
    const headerText = rows
      .slice(0, 5)
      .map((r) => r.join(' '))
      .join(' ');
    const { bank: detected } = detectBank(headerText);
    resolvedBank = detected;
  }

  // Find header row — first row with known column keywords
  let headerRowIdx = -1;
  let headers: string[] = [];

  const allHeaderKeywords = [
    '이용일', '이용일자', '거래일', '거래일시',
    '이용처', '가맹점', '가맹점명', '이용가맹점',
    '이용금액', '거래금액',
  ];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
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

  const dateCol = config?.date
    ? headers.indexOf(config.date)
    : headers.findIndex((h) => /이용일|거래일/.test(h));
  const merchantCol = config?.merchant
    ? headers.indexOf(config.merchant)
    : headers.findIndex((h) => /이용처|가맹점|이용가맹점/.test(h));
  const amountCol = config?.amount
    ? headers.indexOf(config.amount)
    : headers.findIndex((h) => /이용금액|거래금액/.test(h));
  const installCol = config?.installments
    ? headers.indexOf(config.installments)
    : headers.findIndex((h) => /할부/.test(h));
  const categoryCol = config?.category
    ? headers.indexOf(config.category)
    : headers.findIndex((h) => /업종|분류|카테고리/.test(h));
  const memoCol = config?.memo
    ? headers.indexOf(config.memo)
    : headers.findIndex((h) => /비고|적요|메모/.test(h));

  const transactions: import('../types.js').RawTransaction[] = [];
  const errors: import('../types.js').ParseError[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => !c)) continue;

    const dateRaw = dateCol !== -1 ? row[dateCol] : '';
    const merchantRaw = merchantCol !== -1 ? row[merchantCol] : '';
    const amountRaw = amountCol !== -1 ? row[amountCol] : '';

    if (!dateRaw && !merchantRaw) continue;

    const tx = {
      date: parseDateToISO(dateRaw),
      merchant: String(merchantRaw ?? '').replace(/^"(.*)"$/, '$1').trim(),
      amount: parseAmount(amountRaw),
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
