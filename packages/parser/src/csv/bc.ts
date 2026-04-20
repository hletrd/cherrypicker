import type { BankAdapter, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO } from '../date-utils.js';

function parseAmount(raw: string): number | null {
  let cleaned = raw.trim().replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
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

// Expected columns: 이용일, 가맹점, 이용금액, 할부, 업종
const EXPECTED_HEADERS = ['이용일', '가맹점', '이용금액', '할부', '업종'];

export const bcAdapter: BankAdapter = {
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
      if (/합계|총계|소계|total|sum/i.test(line)) continue;
      const cells = splitLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseAmount(amountRaw);
      if (amount === null) {
        if (amountRaw.trim()) {
          errors.push({ line: i + 1, message: `금액을 해석할 수 없습니다: ${amountRaw}`, raw: line });
        }
        continue;
      }
      if (amount === 0) continue;

      const tx: RawTransaction = {
        date: parseDateStringToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseInt(cells[installIdx] ?? '', 10);
        if (!Number.isNaN(inst) && inst > 1) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'bc', format: 'csv', transactions, errors };
  },
};
