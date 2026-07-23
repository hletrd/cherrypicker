import { describe, expect, test } from 'bun:test';
import {
  STATEMENT_FILE_ACCEPT,
  SUPPORTED_STATEMENT_FORMAT_LABELS,
  isSupportedStatementFile,
} from '../src/lib/supported-formats.js';
import {
  MAX_PREVIOUS_SPENDING_KRW,
  validatePreviousSpending,
} from '../src/lib/upload-validation.js';

describe('statement upload format contract', () => {
  test('accepts every supported alias by extension', () => {
    for (const extension of ['csv', 'tsv', 'xls', 'xlsx', 'pdf', 'json', 'ofx', 'qfx', 'html', 'htm']) {
      expect(isSupportedStatementFile({ name: `statement.${extension}`, type: '' })).toBe(true);
      expect(STATEMENT_FILE_ACCEPT).toContain(`.${extension}`);
    }
  });

  test('accepts known MIME types and rejects unrelated files', () => {
    expect(isSupportedStatementFile({ name: 'statement', type: 'text/tab-separated-values' })).toBe(true);
    expect(isSupportedStatementFile({ name: 'malware.exe', type: 'application/octet-stream' })).toBe(false);
    expect(SUPPORTED_STATEMENT_FORMAT_LABELS).toContain('OFX/QFX');
  });
});

describe('previous-spending validation', () => {
  test('preserves empty input as an optional value', () => {
    expect(validatePreviousSpending('')).toEqual({ valid: true, value: undefined });
  });

  test('accepts zero and a bounded integer without clamping', () => {
    expect(validatePreviousSpending('-0')).toEqual({ valid: true, value: 0 });
    expect(validatePreviousSpending(String(MAX_PREVIOUS_SPENDING_KRW))).toEqual({
      valid: true,
      value: MAX_PREVIOUS_SPENDING_KRW,
    });
  });

  test('rejects negative, fractional, non-finite, and over-maximum input', () => {
    for (const value of ['-1', '1.5', 'Infinity', String(MAX_PREVIOUS_SPENDING_KRW + 1)]) {
      const result = validatePreviousSpending(value);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
