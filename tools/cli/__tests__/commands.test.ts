import { describe, expect, test } from 'bun:test';
import { runAnalyze } from '../src/commands/analyze.js';
import { runOptimize } from '../src/commands/optimize.js';
import { runReport } from '../src/commands/report.js';
import { runScrape } from '../src/commands/scrape.js';

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
