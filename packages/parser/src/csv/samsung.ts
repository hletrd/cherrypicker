import type { BankAdapter, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';

function parseDateToISO(raw: string): string {
  const cleaned = raw.trim();
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
  if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}`;
  if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  return cleaned;
}

function parseAmount(raw: string): number {
  return parseInt(raw.trim().replace(/원$/, '').replace(/,/g, ''), 10) || 0;
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map((v) => v.trim());
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

// Expected columns: 이용일, 가맹점명, 이용금액, 할부, 업종
const EXPECTED_HEADERS = ['이용일', '가맹점명', '이용금액', '할부', '업종'];

export const samsungAdapter: BankAdapter = {
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
      // Samsung has both 이용일 and 가맹점명, check both
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

    return { bank: 'samsung', format: 'csv', transactions, errors };
  },
};
