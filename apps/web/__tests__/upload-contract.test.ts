import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
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

describe('upload interaction wiring', () => {
  test('locks analysis inputs and keeps touched previous-spending validation current', async () => {
    const source = await readFile(
      new URL('../src/components/upload/FileDropzone.svelte', import.meta.url),
      'utf8',
    );

    expect(source).toContain('data-testid="analysis-options"');
    expect(source).toContain("disabled={uploadStatus === 'uploading'}");
    expect(source).toContain("aria-busy={uploadStatus === 'uploading'}");
    expect(source).toContain('placeholder="500000"');
    expect(source).not.toContain('placeholder="500,000"');
    expect(source).toContain('oninput={handlePreviousSpendingInput}');
    expect(source).toContain('onblur={handlePreviousSpendingBlur}');
    expect(source).toContain(
      'if (previousSpendingTouched || previousSpendingError !== null)',
    );
  });

  test('uses one persistent live status and deterministic focus destinations', async () => {
    const source = await readFile(
      new URL('../src/components/upload/FileDropzone.svelte', import.meta.url),
      'utf8',
    );

    expect(source).toContain('data-testid="upload-status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('{uploadStatusMessage}');
    expect(source).toContain('data-upload-file-remove');
    expect(source).toContain('await focusFileAction(index)');
    expect(source).toContain('retryButtonEl?.focus()');
    expect(source).toContain('submitButtonEl?.focus()');
    expect(source).toContain('dashboardButtonEl?.focus()');
    expect(source).toContain('async function revealAllBanks()');
    expect(source).toContain(
      '`[data-testid="bank-pill-${firstAdditionalBank.value}"]`',
    );
    expect(source).toContain('onclick={revealAllBanks}');
    expect(source).toContain('대시보드 보기');
    expect(source).not.toContain('PendingNavigation');
    expect(source).not.toContain('successNavigation');
  });

  test('uses verified foregrounds for inactive steps and dark retry state', async () => {
    const source = await readFile(
      new URL('../src/components/upload/FileDropzone.svelte', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      "'bg-[var(--color-border)] text-[var(--color-text)]'",
    );
    expect(source).toContain('dark:text-red-300');
    expect(source).toContain('dark:border-red-700');
    expect(source).toContain('dark:hover:text-red-200');
  });
});
