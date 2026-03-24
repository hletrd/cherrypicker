export type FileFormat = 'csv' | 'xlsx' | 'pdf';
export type BankId = 'hyundai' | 'kb' | 'ibk' | 'woori' | 'samsung' | 'shinhan' | 'lotte' | 'hana' | 'nh' | 'bc';

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
  isOnline?: boolean;
}

export interface ParseResult {
  bank: BankId | null;
  format: FileFormat;
  transactions: RawTransaction[];
  statementPeriod?: { start: string; end: string };
  cardNumber?: string;  // Masked: **** **** **** 1234
  errors: ParseError[];
}

export interface ParseError {
  line?: number;
  message: string;
  raw?: string;
}

export interface BankAdapter {
  bankId: BankId;
  detect(content: string): boolean;
  parseCSV?(content: string): ParseResult;
  parseXLSX?(rows: unknown[][]): ParseResult;
}
