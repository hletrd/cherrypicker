export type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'json' | 'ofx' | 'html';
export type BankId = 'hyundai' | 'kb' | 'ibk' | 'woori' | 'samsung' | 'shinhan' | 'lotte' | 'hana' | 'nh' | 'bc' | 'kakao' | 'toss' | 'kbank' | 'bnk' | 'dgb' | 'suhyup' | 'jb' | 'kwangju' | 'jeju' | 'sc' | 'mg' | 'cu' | 'kdb' | 'epost';
import type { ParsedTransactionFacts } from './shared/transaction-facts.js';

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

  constructor(
    message: string,
    options?: { code?: string; line?: number; raw?: string; file?: string; format?: FileFormat },
  ) {
    super(message);
    this.name = 'ParseError';
    this.code = options?.code;
    this.line = options?.line;
    this.raw = options?.raw;
    this.file = options?.file;
    this.format = options?.format;
  }
}

export interface BankAdapter {
  bankId: BankId;
  detect(content: string): boolean;
  parseCSV?(content: string): ParseResult;
  parseXLSX?(rows: unknown[][]): ParseResult;
}
