import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { detectBank, detectCSVDelimiter, detectFormat } from '../src/detect.js';

describe('detectBank', () => {
  test('detects KB from content', () => {
    const { bank, confidence } = detectBank('KB국민카드 이용내역\n거래일시,가맹점명,이용금액');
    expect(bank).toBe('kb');
    expect(confidence).toBeGreaterThan(0);
  });

  test('detects shinhan from content', () => {
    const { bank } = detectBank('신한카드 이용내역\n이용일,이용처,이용금액');
    expect(bank).toBe('shinhan');
  });

  test('detects samsung from content', () => {
    const { bank } = detectBank('삼성카드 이용내역\n이용일,가맹점명,이용금액');
    expect(bank).toBe('samsung');
  });

  test('detects hyundai from content', () => {
    const { bank } = detectBank('현대카드 이용내역');
    expect(bank).toBe('hyundai');
  });

  test('detects lotte from content', () => {
    const { bank } = detectBank('롯데카드 이용내역');
    expect(bank).toBe('lotte');
  });

  test('detects hana from content', () => {
    const { bank } = detectBank('하나카드 이용내역');
    expect(bank).toBe('hana');
  });

  test('detects nh from content', () => {
    const { bank } = detectBank('NH농협 이용내역');
    expect(bank).toBe('nh');
  });

  test('detects bc from content', () => {
    const { bank } = detectBank('BC카드 이용내역');
    expect(bank).toBe('bc');
  });

  test('detects ibk from content', () => {
    const { bank } = detectBank('IBK기업은행 이용내역');
    expect(bank).toBe('ibk');
  });

  test('detects woori from content', () => {
    const { bank } = detectBank('우리카드 이용내역');
    expect(bank).toBe('woori');
  });

  test('returns null for unrecognized content', () => {
    const { bank, confidence } = detectBank('거래일시,금액,가맹점');
    expect(bank).toBeNull();
    expect(confidence).toBe(0);
  });

  test('confidence is higher when multiple patterns match', () => {
    // shinhan has patterns for 신한카드 AND SHINHAN — two matches
    const { confidence: c1 } = detectBank('신한카드');
    const { confidence: c2 } = detectBank('신한카드 SHINHAN');
    expect(c2).toBeGreaterThan(c1);
  });

  test('case-insensitive detection for HYUNDAICARD', () => {
    const { bank } = detectBank('HYUNDAICARD 이용내역');
    expect(bank).toBe('hyundai');
  });

  test('case-insensitive detection for kbcard', () => {
    const { bank } = detectBank('kbcard 이용내역');
    expect(bank).toBe('kb');
  });
});

describe('detectCSVDelimiter', () => {
  test('detects comma delimiter', () => {
    const delimiter = detectCSVDelimiter('거래일시,가맹점명,이용금액,할부개월,업종');
    expect(delimiter).toBe(',');
  });

  test('detects tab delimiter', () => {
    const delimiter = detectCSVDelimiter('거래일시\t가맹점명\t이용금액\t할부개월\t업종');
    expect(delimiter).toBe('\t');
  });

  test('detects pipe delimiter', () => {
    const delimiter = detectCSVDelimiter('거래일시|가맹점명|이용금액|할부개월|업종');
    expect(delimiter).toBe('|');
  });

  test('defaults to comma for single-column content', () => {
    const delimiter = detectCSVDelimiter('거래일시');
    expect(delimiter).toBe(',');
  });

  test('tab wins when tie between comma and tab is broken by tab count', () => {
    // tab count >= comma count → tab wins
    const delimiter = detectCSVDelimiter('a\tb\tc,d');
    expect(delimiter).toBe('\t');
  });
});

describe('detectFormat', () => {
  const fixturesDir = join(import.meta.dir, 'fixtures');

  test('detects CSV from .csv extension', async () => {
    const result = await detectFormat(join(fixturesDir, 'sample-kb.csv'));
    expect(result.format).toBe('csv');
  });

  test('detects bank from KB CSV content', async () => {
    const result = await detectFormat(join(fixturesDir, 'sample-kb.csv'));
    expect(result.bank).toBe('kb');
  });

  test('detects bank from Samsung CSV content', async () => {
    const result = await detectFormat(join(fixturesDir, 'sample-samsung.csv'));
    expect(result.format).toBe('csv');
    expect(result.bank).toBe('samsung');
  });

  test('encoding is reported for csv', async () => {
    const result = await detectFormat(join(fixturesDir, 'sample-kb.csv'));
    expect(result.encoding).toBeDefined();
  });
});
