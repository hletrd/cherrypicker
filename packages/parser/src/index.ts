import { readFile } from 'fs/promises';
import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';
import { detectFormat, detectEncoding, decodeBuffer } from './detect.js';
import { parseCSV } from './csv/index.js';
import { parseXLSX } from './xlsx/index.js';
import { parsePDF } from './pdf/index.js';
import { parseJSON } from './json/index.js';
import { parseOFX } from './ofx/index.js';
import { parseHTML } from './html/index.js';

export type { FileFormat, BankId, DetectionResult, RawTransaction, ParseResult, ParseError, BankAdapter } from './types.js';
export { detectFormat, detectBank, detectCSVDelimiter, detectEncoding, decodeBuffer } from './detect.js';
export { parseCSV } from './csv/index.js';
export { parseXLSX } from './xlsx/index.js';
export { parsePDF } from './pdf/index.js';
export { parseJSON } from './json/index.js';
export { parseOFX } from './ofx/index.js';
export { parseHTML } from './html/index.js';
export { parseGenericCSV } from './csv/generic.js';
export { findColumn, normalizeHeader, DATE_COLUMN_PATTERN, MERCHANT_COLUMN_PATTERN, AMOUNT_COLUMN_PATTERN, INSTALLMENTS_COLUMN_PATTERN, CATEGORY_COLUMN_PATTERN, MEMO_COLUMN_PATTERN, SUMMARY_ROW_PATTERN, HEADER_KEYWORDS, DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS, isValidHeaderRow } from './csv/column-matcher.js';
export { createBankAdapter, kakaoAdapter, tossAdapter, kbankAdapter, bnkAdapter, dgbAdapter, suhyupAdapter, jbAdapter, kwangjuAdapter, jejuAdapter, scAdapter, mgAdapter, cuAdapter, kdbAdapter, epostAdapter } from './csv/adapter-factory.js';
export { isValidISODate, isValidShortDate } from './date-utils.js';
export { parseAmount, parseAmountString } from './amount.js';
export { normalizeHTML } from './csv/shared.js';

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
function enrichErrors(result: ParseResult, filePath: string): ParseResult {
  for (const err of result.errors) {
    if (err instanceof ParseError) {
      if (!err.file) err.file = filePath;
      if (!err.format) err.format = result.format;
    }
  }
  return result;
}

export async function parseStatement(filePath: string, options?: ParseOptions): Promise<ParseResult> {
  const detection = await detectFormat(filePath);
  const bank = options?.bank ?? detection.bank ?? undefined;

  switch (detection.format) {
    case 'csv': {
      const buffer = await readFile(filePath);
      // Use encoding detection from detect module which handles UTF-16,
      // CP949 byte-pattern analysis, and BOM detection (C7-02/C7-03).
      const encoding = detection.encoding ?? detectEncoding(buffer);
      const content = decodeBuffer(buffer, encoding);
      return enrichErrors(parseCSV(content, bank), filePath);
    }

    case 'xlsx':
      return enrichErrors(await parseXLSX(filePath, bank), filePath);

    case 'pdf':
      return enrichErrors(
        await parsePDF(filePath, bank, { allowRemoteLLM: options?.allowRemoteLLM ?? false }),
        filePath,
      );

    case 'json': {
      const buffer = await readFile(filePath);
      const content = buffer.toString('utf-8');
      return enrichErrors(parseJSON(content, bank), filePath);
    }

    case 'ofx': {
      const buffer = await readFile(filePath);
      const content = buffer.toString('utf-8');
      return enrichErrors(parseOFX(content, bank), filePath);
    }

    case 'html': {
      const buffer = await readFile(filePath);
      const content = buffer.toString('utf-8');
      return enrichErrors(parseHTML(content, bank), filePath);
    }

    default: {
      const exhaustive: never = detection.format;
      return {
        bank: bank ?? null,
        format: detection.format,
        transactions: [],
        errors: [new ParseError(`지원하지 않는 파일 형식입니다: ${exhaustive}`, { file: filePath, format: detection.format })],
      };
    }
  }
}
