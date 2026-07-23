import {
  parseJSONTransactions,
  type JSONParseDiagnostic,
} from '@cherrypicker/parser/browser';
import type { BankId, ParseResult } from './types.js';
import { ParseError } from './types.js';

function toParseError(error: JSONParseDiagnostic): ParseError {
  return new ParseError(error.message, {
    code: error.code,
    line: error.line,
  });
}

/** Web adapter for the browser-safe canonical JSON grammar. */
export function parseJSON(content: string, bank?: BankId): ParseResult {
  const parsed = parseJSONTransactions(content);
  return {
    bank: bank ?? null,
    format: 'json',
    transactions: parsed.transactions,
    errors: parsed.errors.map(toParseError),
  };
}
