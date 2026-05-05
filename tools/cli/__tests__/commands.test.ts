import { describe, expect, test } from 'bun:test';
import { runAnalyze } from '../src/commands/analyze.js';
import { runOptimize } from '../src/commands/optimize.js';
import { runReport } from '../src/commands/report.js';
import { runScrape } from '../src/commands/scrape.js';
import { validateFilePath } from '../src/validation.js';

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
});
