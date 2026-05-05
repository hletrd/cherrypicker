import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAnalyze } from '../src/commands/analyze.js';
import { runOptimize } from '../src/commands/optimize.js';
import { runReport } from '../src/commands/report.js';
import { runScrape } from '../src/commands/scrape.js';
import { validateFilePath } from '../src/validation.js';
import { requireRemoteLLMConsent } from '../src/consent.js';

let tempDir: string;
let tempPdf: string;
let tempCsv: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'cherrypicker-test-'));
  tempPdf = join(tempDir, 'statement.pdf');
  tempCsv = join(tempDir, 'statement.csv');
  writeFileSync(tempPdf, 'fake pdf content');
  writeFileSync(tempCsv, 'date,merchant,amount\n2024-01-01,test,10000');
});

afterAll(() => {
  try { unlinkSync(tempPdf); } catch {}
  try { unlinkSync(tempCsv); } catch {}
  try { rmdirSync(tempDir); } catch {}
});

describe('CLI command argument guards', () => {
  test('analyze requires a statement path', async () => {
    await expect(runAnalyze([])).rejects.toThrow('명세서 파일 경로를 지정하세요');
  });

  test('optimize requires a statement path', async () => {
    await expect(runOptimize([])).rejects.toThrow('명세서 파일 경로를 지정하세요');
  });

  test('report requires a statement path', async () => {
    await expect(runReport([])).rejects.toThrow('명세서 파일 경로를 지정하세요');
  });

  test('scrape requires an issuer', async () => {
    await expect(runScrape([])).rejects.toThrow('--issuer 옵션이 필요합니다');
  });
});

describe('LLM fallback consent (C1)', () => {
  test('PDF without --allow-remote-llm throws with instructions', async () => {
    await expect(runAnalyze([tempPdf])).rejects.toThrow('--allow-remote-llm');
  });

  test('non-PDF file skips consent and proceeds to parsing', async () => {
    // CSV file should skip LLM consent and complete without error
    await expect(runAnalyze([tempCsv])).resolves.toBeUndefined();
  });

  test('requireRemoteLLMConsent returns false for non-PDF', async () => {
    const result = await requireRemoteLLMConsent(tempCsv, false, false);
    expect(result).toBe(false);
  });

  test('requireRemoteLLMConsent throws for PDF without flag', async () => {
    await expect(requireRemoteLLMConsent(tempPdf, false, false)).rejects.toThrow('--allow-remote-llm');
  });

  test('requireRemoteLLMConsent returns true for PDF with flag in non-interactive mode', async () => {
    const result = await requireRemoteLLMConsent(tempPdf, true, true);
    expect(result).toBe(true);
  });
});

describe('validateFilePath', () => {
  test('rejects path containing ..', () => {
    expect(() => validateFilePath('../foo.csv', { mustExist: false })).toThrow('상위 디렉토리 참조');
    expect(() => validateFilePath('foo/../bar.csv', { mustExist: false })).toThrow('상위 디렉토리 참조');
    expect(() => validateFilePath('/tmp/../etc/passwd', { mustExist: false })).toThrow('상위 디렉토리 참조');
  });

  test('rejects non-existent file when mustExist is true', () => {
    expect(() => validateFilePath('/nonexistent/file.csv', { mustExist: true })).toThrow('찾을 수 없습니다');
  });

  test('allows non-existent file when mustExist is false', () => {
    expect(() => validateFilePath('/nonexistent/file.csv', { mustExist: false })).not.toThrow();
  });

  test('allows valid existing file', () => {
    // Use this test file itself as a known-existing file
    const testFile = import.meta.filename;
    expect(() => validateFilePath(testFile, { mustExist: true })).not.toThrow();
  });

  test('rejects empty path', () => {
    expect(() => validateFilePath('', { mustExist: false })).toThrow('비어 있습니다');
  });

  test('allows path with double dots in filename (not segment)', () => {
    expect(() => validateFilePath('foo..bar.csv', { mustExist: false })).not.toThrow();
  });

  test('strips null bytes from path before validation', () => {
    // Null bytes should be stripped; the cleaned path should not contain them.
    // After stripping \x00, /tmp/file\x00.txt has no traversal and passes.
    expect(() => validateFilePath('/tmp/file\x00.txt', { mustExist: false })).not.toThrow();
  });

  test('rejects symbolic link when mustExist is true', () => {
    const { symlinkSync, unlinkSync } = require('node:fs');
    const { join } = require('node:path');
    const linkPath = join(tempDir, 'evil-link');
    symlinkSync(tempCsv, linkPath);
    expect(() => validateFilePath(linkPath, { mustExist: true })).toThrow('심볼릭 링크');
    unlinkSync(linkPath);
  });
});
