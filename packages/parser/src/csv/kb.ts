import type { BankAdapter, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectCSVDelimiter } from '../detect.js';
import { parseDateStringToISO } from '../date-utils.js';
import { splitCSVLine, parseCSVAmount, parseCSVInstallments } from './shared.js';

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
      const cells = splitCSVLine(lines[i] ?? '', delimiter);
      if (cells.some((c) => EXPECTED_HEADERS.includes(c))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return { bank: 'kb', format: 'csv', transactions: [], errors: [{ message: '헤더 행을 찾을 수 없습니다.' }] };
    }

    const headers = splitCSVLine(lines[headerIdx] ?? '', delimiter);
    const dateIdx = headers.indexOf('거래일시');
    const merchantIdx = headers.indexOf('가맹점명');
    const amountIdx = headers.indexOf('이용금액');
    const installIdx = headers.indexOf('할부개월');
    const categoryIdx = headers.indexOf('업종');

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
      if (amount <= 0) continue;

      const tx: RawTransaction = {
        date: parseDateStringToISO(dateRaw),
        merchant: merchantRaw.replace(/^"(.*)"$/, '$1'),
        amount,
      };

      if (installIdx !== -1 && cells[installIdx]) {
        const inst = parseCSVInstallments(cells[installIdx]);
        if (inst !== undefined) tx.installments = inst;
      }
      if (categoryIdx !== -1 && cells[categoryIdx]) tx.category = cells[categoryIdx];

      transactions.push(tx);
    }

    return { bank: 'kb', format: 'csv', transactions, errors };
  },
};
