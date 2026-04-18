import type { BankAdapter, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';

function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})/);
  if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
  if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
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

// Expected columns: 거래일시, 가맹점명, 이용금액, 할부개월, 업종
const EXPECTED_HEADERS = ['거래일시', '가맹점명', '이용금액', '할부개월', '업종'];

export const kbAdapter: BankAdapter = {
  bankId: 'kb',

  detect(content: string): boolean {
    return /KB국민카드/.test(content) || /국민카드/.test(content) || /kbcard/i.test(content);
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
      if (/합계|총계|소계|total|sum/i.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount: parseAmount(amountRaw),
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInt(cells[installIdx] ?? '', 10);
        if (!isNaN(inst) && inst > 1) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'kb', format: 'csv', transactions, errors };
  },
};
