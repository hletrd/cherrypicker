import type { BankAdapter, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO } from '../date-utils.js';
import { splitCSVLine, parseCSVAmount, parseCSVInstallments } from './shared.js';

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
      const cells = splitCSVLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => EXPECTED_HEADERS.includes(c))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'ibk', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('거래일');
    const merchantIdx = headers.indexOf('가맹점');
    const amountIdx = headers.indexOf('거래금액');
    const installIdx = headers.indexOf('할부');
    const memoIdx = headers.indexOf('적요');

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.trim()) continue;
      if (/합계|총계|소계|total|sum/i.test(line)) continue;
      const cells = splitCSVLine(line, delimiter);

      const dateRaw = dateIdx !== -1 ? (cells[dateIdx] ?? '') : '';
      const merchantRaw = merchantIdx !== -1 ? (cells[merchantIdx] ?? '') : '';
      const amountRaw = amountIdx !== -1 ? (cells[amountIdx] ?? '') : '';

      if (!dateRaw && !merchantRaw) continue;

      const amount = parseCSVAmount(amountRaw);
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
        const inst = parseCSVInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (memoIdx !== -1 && cells[memoIdx]) tx.memo = cells[memoIdx];

      transactions.push(tx);
    }

    return { bank: 'ibk', format: 'csv', transactions, errors };
  },
};
