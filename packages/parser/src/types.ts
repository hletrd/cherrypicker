export type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'json' | 'ofx' | 'html';
export type BankId = 'hyundai' | 'kb' | 'ibk' | 'woori' | 'samsung' | 'shinhan' | 'lotte' | 'hana' | 'nh' | 'bc' | 'kakao' | 'toss' | 'kbank' | 'bnk' | 'dgb' | 'suhyup' | 'jb' | 'kwangju' | 'jeju' | 'sc' | 'mg' | 'cu' | 'kdb' | 'epost';

export interface DetectionResult {
  format: FileFormat;
  bank: BankId | null;
  confidence: number;
  encoding?: string;
}

export interface RawTransaction {
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
  line?: number;
  raw?: string;
  file?: string;
  format?: FileFormat;

  constructor(
    message: string,
    options?: { line?: number; raw?: string; file?: string; format?: FileFormat },
  ) {
    super(message);
    this.name = 'ParseError';
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
