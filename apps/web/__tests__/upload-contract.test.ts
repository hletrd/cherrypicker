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
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_COUNT,
  MAX_UPLOAD_TOTAL_BYTES,
  admitUploadFiles,
} from '../src/lib/upload-admission.js';

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

describe('upload admission contract', () => {
  const file = (name: string, size: number, type = 'text/csv') => ({
    name,
    size,
    type,
  });

  test('accepts exact byte boundaries', () => {
    const existing = [
      file('first.csv', MAX_UPLOAD_TOTAL_BYTES - MAX_UPLOAD_FILE_BYTES),
    ];
    expect(
      admitUploadFiles(existing, [
        file('last.csv', MAX_UPLOAD_FILE_BYTES),
      ]).accepted,
    ).toHaveLength(1);
  });

  test('rejects per-file and aggregate overflow without mutating order', () => {
    const result = admitUploadFiles(
      [file('existing.csv', MAX_UPLOAD_TOTAL_BYTES - 10)],
      [
        file('too-large.csv', MAX_UPLOAD_FILE_BYTES + 1),
        file('aggregate.csv', 11),
        file('fits.csv', 10),
      ],
    );
    expect(result.oversized.map(({ name }) => name)).toEqual(['too-large.csv']);
    expect(result.overAggregateBytes.map(({ name }) => name)).toEqual([
      'aggregate.csv',
    ]);
    expect(result.accepted.map(({ name }) => name)).toEqual(['fits.csv']);
  });

  test('enforces count and catches duplicates within one addition', () => {
    const existing = Array.from({ length: MAX_UPLOAD_FILE_COUNT - 1 }, (_, index) =>
      file(`existing-${index}.csv`, 1),
    );
    const result = admitUploadFiles(existing, [
      file('new.csv', 1),
      file('new.csv', 1),
      file('over-count.csv', 1),
    ]);
    expect(result.accepted.map(({ name }) => name)).toEqual(['new.csv']);
    expect(result.duplicates.map(({ name }) => name)).toEqual(['new.csv']);
    expect(result.overFileCount.map(({ name }) => name)).toEqual([
      'over-count.csv',
    ]);
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
