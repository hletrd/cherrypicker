export type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'json' | 'ofx' | 'html';
export type BankId = 'hyundai' | 'kb' | 'ibk' | 'woori' | 'samsung' | 'shinhan' | 'lotte' | 'hana' | 'nh' | 'bc' | 'kakao' | 'toss' | 'kbank' | 'bnk' | 'dgb' | 'suhyup' | 'jb' | 'kwangju' | 'jeju' | 'sc' | 'mg' | 'cu' | 'kdb' | 'epost';
import type { ParsedTransactionFacts } from './shared/transaction-facts.js';
import {
  createBoundedDiagnosticArray,
  PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
  PARSE_DIAGNOSTICS_OMITTED_MESSAGE,
} from './shared/diagnostics.js';

export interface DetectionResult {
  format: FileFormat;
  bank: BankId | null;
  confidence: number;
  encoding?: string;
  errors?: ParseError[];
}

export interface RawTransaction extends ParsedTransactionFacts {
  date: string;
  merchant: string;
  amount: number;
  installments?: number;
  category?: string;    // Bank's own category if available
  memo?: string;
}

export interface ParseResult {
  bank: BankId | null;
  format: FileFormat;
  transactions: RawTransaction[];
  statementPeriod?: { start: string; end: string };
  cardNumber?: string;  // Masked: **** **** **** 1234
  errors: ParseError[];
}

export class ParseError extends Error {
  code?: string;
  line?: number;
  raw?: string;
  file?: string;
  format?: FileFormat;
  count?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      line?: number;
      raw?: string;
      file?: string;
      format?: FileFormat;
      count?: number;
    },
  ) {
    super(message);
    this.name = 'ParseError';
    this.code = options?.code;
    this.line = options?.line;
    this.raw = options?.raw;
    this.file = options?.file;
    this.format = options?.format;
    this.count = options?.count;
  }
}

export function createParseErrorCollector(): ParseError[] {
  return createBoundedDiagnosticArray<ParseError>(
    (count) => new ParseError(PARSE_DIAGNOSTICS_OMITTED_MESSAGE, {
      code: PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
      count,
    }),
  );
}

export interface BankAdapter {
  bankId: BankId;
  detect(content: string): boolean;
  parseCSV?(content: string): ParseResult;
  parseXLSX?(rows: unknown[][]): ParseResult;
}
