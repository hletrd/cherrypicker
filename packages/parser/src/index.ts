import { readFile } from 'fs/promises';
import type { BankId, ParseResult } from './types.js';
import { detectFormat } from './detect.js';
import { parseCSV } from './csv/index.js';
import { parseXLSX } from './xlsx/index.js';
import { parsePDF } from './pdf/index.js';

export type { FileFormat, BankId, DetectionResult, RawTransaction, ParseResult, ParseError, BankAdapter } from './types.js';
export { detectFormat, detectBank, detectCSVDelimiter } from './detect.js';
export { parseCSV } from './csv/index.js';
export { parseXLSX } from './xlsx/index.js';
export { parsePDF } from './pdf/index.js';
export { parseGenericCSV } from './csv/generic.js';
export { findColumn, normalizeHeader, DATE_COLUMN_PATTERN, MERCHANT_COLUMN_PATTERN, AMOUNT_COLUMN_PATTERN, INSTALLMENTS_COLUMN_PATTERN, CATEGORY_COLUMN_PATTERN, MEMO_COLUMN_PATTERN } from './csv/column-matcher.js';
export { createBankAdapter } from './csv/adapter-factory.js';

export interface ParseOptions {
  bank?: BankId;
  allowRemoteLLM?: boolean;
}

/**
 * Parse a credit card statement file.
 * Auto-detects format (CSV, XLSX, PDF) from file extension and content.
 * Auto-detects bank from file content unless explicitly specified.
 *
 * @param filePath - Absolute path to the statement file
 * @param options - Optional: specify bank ID to skip auto-detection
 * @returns ParseResult with transactions and any errors encountered
 */
export async function parseStatement(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const detection = await detectFormat(filePath);
  const bank = options?.bank ?? detection.bank ?? undefined;

  switch (detection.format) {
    case 'csv': {
      const buffer = await readFile(filePath);
      // Try UTF-8 first, then CP949 fallback via TextDecoder
      let content: string;
      try {
        content = buffer.toString('utf-8');
        // Sanity check: if too many replacement chars per KB, try CP949
        const replacementCount = (content.match(/\uFFFD/g) ?? []).length;
        const ratio = replacementCount / (content.length / 1024);
        if (ratio > 1) {
          const decoder = new TextDecoder('cp949');
          content = decoder.decode(buffer);
        }
      } catch {
        const decoder = new TextDecoder('cp949');
        content = decoder.decode(buffer);
      }
      return parseCSV(content, bank);
    }

    case 'xlsx':
      return parseXLSX(filePath, bank);

    case 'pdf':
      return parsePDF(filePath, bank, { allowRemoteLLM: options?.allowRemoteLLM ?? false });

    default: {
      const exhaustive: never = detection.format;
      return {
        bank: bank ?? null,
        format: detection.format,
        transactions: [],
        errors: [{ message: `지원하지 않는 파일 형식입니다: ${exhaustive}` }],
      };
    }
  }
}
