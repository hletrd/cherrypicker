import type { BankAdapter, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';

function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (fullMatch) {
    const month = parseInt(fullMatch[2]!, 10);
    const day = parseInt(fullMatch[3]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
    }
  }
  if (/^\d{8}$/.test(cleaned)) {
    const month = parseInt(cleaned.slice(4, 6), 10);
    const day = parseInt(cleaned.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
  }
  return cleaned;
}

function parseAmount(raw: string): number {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  const n = parseInt(cleaned, 10);
  if (isNaN(n)) return NaN;
  return isNeg ? -n : n;
}

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

// Expected columns: 거래일, 가맹점, 거래금액, 할부, 적요
const EXPECTED_HEADERS = ['거래일', '가맹점', '거래금액', '할부', '적요'];

export const ibkAdapter: BankAdapter = {
  bankId: 'ibk',

  detect(content: string): boolean {
    return /IBK기업은행/.test(content) || /기업은행/.test(content);
  },

  parseCSV(content: string): ParseResult {
    const delimiter = detectCSVDelimiter(content);
    const lines = content.split('\n').filter((l) => l.trim());
    const errors: ParseError[] = [];
    const transactions: RawTransaction[] = [];

    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = splitLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => EXPECTED_HEADERS.includes(c))) {
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
      if (/합계|총계|소계|total|sum/i.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (isNaN(amount)) {
        if (amountRaw.trim()) {
          errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
        }
        continue;
      }

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInt(cells[installIdx] ?? '', 10);
        if (!isNaN(inst) && inst > 1) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'ibk', format: 'csv', transactions, errors };
  },
};
