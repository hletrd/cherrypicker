import type { BankId, ParseResult, RawTransaction, ParseError } from '../types.js';
import { detectBank } from '../detect.js';
import { extractText } from './extractor.js';
import { parseTable, filterTransactionRows } from './table-parser.js';
import { parsePDFWithLLM } from './llm-fallback.js';

const DATE_PATTERN = /(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/;
const AMOUNT_PATTERN = /^-?[\d,]+원?$/;

function parseDateToISO(raw: string): string {
  const match = raw.match(DATE_PATTERN);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return raw;
}

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10) || 0;
}

function findDateCell(row: string[]): { idx: number; value: string } | null {
  for (let i = 0; i < row.length; i++) {
    if (DATE_PATTERN.test(row[i] ?? '')) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function findAmountCell(row: string[]): { idx: number; value: string } | null {
  for (let i = row.length - 1; i >= 0; i--) {
    if (AMOUNT_PATTERN.test((row[i] ?? '').trim())) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}

function tryStructuredParse(text: string, bank: BankId | null): RawTransaction[] | null {
  try {
    const rows = parseTable(text);
    const txRows = filterTransactionRows(rows);

    if (txRows.length === 0) return null;

    const transactions: RawTransaction[] = [];

    for (const row of txRows) {
      const dateCell = findDateCell(row);
      const amountCell = findAmountCell(row);

      if (!dateCell || !amountCell) continue;

      // Merchant is the cell between date and amount (or the largest non-date, non-amount cell)
      let merchantIdx = -1;
      for (let i = dateCell.idx + 1; i < amountCell.idx; i++) {
        if ((row[i] ?? '').trim()) {
          merchantIdx = i;
          break;
        }
      }

      const merchant = merchantIdx !== -1 ? (row[merchantIdx] ?? '').trim() : '';
      const amount = parseAmount(amountCell.value);

      if (!merchant && amount === 0) continue;

      const tx: RawTransaction = {
        date: parseDateToISO(dateCell.value),
        merchant,
        amount,
      };

      // Look for installment info in remaining cells
      for (let i = 0; i < row.length; i++) {
        if (i === dateCell.idx || i === amountCell.idx || i === merchantIdx) continue;
        const cell = (row[i] ?? '').trim();
        const instMatch = cell.match(/^(\d+)개?월?$/);
        if (instMatch) {
          const inst = parseInt(instMatch[1] ?? '', 10);
          if (inst > 1) tx.installments = inst;
        }
      }

      transactions.push(tx);
    }

    return transactions.length > 0 ? transactions : null;
  } catch {
    return null;
  }
}

export async function parsePDF(filePath: string, bank?: BankId): Promise<ParseResult> {
  const errors: ParseError[] = [];
  let text: string;

  // Tier 1: Extract text
  try {
    text = await extractText(filePath);
  } catch (err) {
    return {
      bank: bank ?? null,
      format: 'pdf',
      transactions: [],
      errors: [{ message: `PDF 텍스트 추출 실패: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  // Detect bank if not provided
  const resolvedBank: BankId | null = bank ?? detectBank(text).bank;

  // Tier 2: Try structured table parsing
  const structured = tryStructuredParse(text, resolvedBank);
  if (structured && structured.length > 0) {
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: structured,
      errors,
    };
  }

  errors.push({ message: '구조화된 파싱 실패, LLM 폴백 시도 중...' });

  // Tier 3: LLM fallback
  try {
    const llmTransactions = await parsePDFWithLLM(text);
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: llmTransactions,
      errors,
    };
  } catch (err) {
    errors.push({
      message: `LLM 폴백 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      bank: resolvedBank,
      format: 'pdf',
      transactions: [],
      errors,
    };
  }
}
