import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectBank, detectCSVDelimiter, detectFormat, detectEncoding, decodeBuffer } from '../../../packages/parser/src/detect.js';
import { sampleNonEmptyDelimitedLines } from '../../../packages/parser/src/shared/delimiter.js';
import { detectCSVDelimiter as detectBrowserCSVDelimiter } from '../src/lib/parser/detect.js';

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

  test('detects kakao from content', () => {
    const { bank } = detectBank('카카오뱅크 체크카드 이용내역');
    expect(bank).toBe('kakao');
  });

  test('detects toss from content', () => {
    const { bank } = detectBank('토스뱅크 카드 이용내역');
    expect(bank).toBe('toss');
  });

  test('does not mis-detect merchant text as toss bank', () => {
    const { bank } = detectBank('토스페이먼츠 주식회사 결제대행');
    expect(bank).toBeNull();
  });

  test('does not mis-detect convenience-store merchant text as cu bank', () => {
    const { bank } = detectBank('CU편의점 강남역점');
    expect(bank).toBeNull();
  });

  test('does not mis-detect MG merchant aliases as mg bank', () => {
    const { bank } = detectBank('메가MG 피트니스');
    expect(bank).toBeNull();
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

  test('browser and package sampling stops after 30 non-empty lines', () => {
    const sampledPrefix = Array.from(
      { length: 30 },
      (_, index) => `2026-07-${String(index + 1).padStart(2, '0')},merchant,10000\n`,
    ).join('');
    const multiMegabyteSuffix = 'a\tb\tc\n'.repeat(500_000);
    const content = `${sampledPrefix}${multiMegabyteSuffix}`;

    const sample = sampleNonEmptyDelimitedLines(content);

    expect(sample.lines).toHaveLength(30);
    expect(sample.consumedLength).toBe(sampledPrefix.length);
    expect(sample.consumedLength).toBeLessThan(content.length / 100);
    expect(detectCSVDelimiter(content)).toBe(',');
    expect(detectBrowserCSVDelimiter(content)).toBe(',');
  });
});

describe('detectFormat', () => {
  const fixturesDir = join(
    import.meta.dir,
    '../../../packages/parser/__tests__/fixtures',
  );

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

  test('BOM does not break format detection (C6-02)', async () => {
    const result = await detectFormat(join(fixturesDir, 'sample-bom.csv'));
    expect(result.format).toBe('csv');
    // The BOM fixture has no bank-specific text, so bank is expected to be null.
    // The key assertion is that format detection succeeds despite the BOM.
    expect(result.encoding).toBe('utf-8');
  });
});

// ---------------------------------------------------------------------------
// Encoding detection tests (C7-02/C7-03)
// ---------------------------------------------------------------------------

describe('detectEncoding', () => {
  test('detects UTF-16 LE from BOM', () => {
    // UTF-16 LE BOM: FF FE
    const buffer = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x69, 0x00]);
    expect(detectEncoding(buffer)).toBe('utf-16le');
  });

  test('detects UTF-16 BE from BOM', () => {
    // UTF-16 BE BOM: FE FF
    const buffer = Buffer.from([0xFE, 0xFF, 0x00, 0x48, 0x00, 0x69]);
    expect(detectEncoding(buffer)).toBe('utf-16be');
  });

  test('detects UTF-8 from BOM', () => {
    const buffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    expect(detectEncoding(buffer)).toBe('utf-8');
  });

  test('detects UTF-8 for pure ASCII', () => {
    const buffer = Buffer.from('Hello,World,123', 'utf-8');
    expect(detectEncoding(buffer)).toBe('utf-8');
  });

  test('detects UTF-8 for valid UTF-8 Korean text', () => {
    const buffer = Buffer.from('거래일시,가맹점명,이용금액', 'utf-8');
    expect(detectEncoding(buffer)).toBe('utf-8');
  });

  test('detects CP949 for CP949-encoded Korean text', () => {
    // CP949 encoding of "거래일시,가맹점명,이용금액" repeated to exceed 100 bytes.
    // CP949 lead bytes are in 0x80-0xBF range (not valid UTF-8 lead bytes).
    const segment = Buffer.from([
      0xB0, 0xA1, 0xC0, 0xDA, 0xC0, 0xCF, 0xBD, 0xC3, // 거래일시
      0x2C, // comma
      0xB0, 0xCB, 0xB8, 0xAE, 0xC1, 0xF6, 0xB8, 0xDE, // 가맹점명
      0x2C, // comma
      0xC0, 0xCF, 0xBB, 0xF3, 0xB0, 0xE8, 0xB9, 0xE2, // 이용금액
    ]);
    // Repeat to reach >100 bytes so the per-KB ratio heuristic is reliable.
    const cp949Text = Buffer.concat(Array(5).fill(segment));
    expect(detectEncoding(cp949Text)).toBe('cp949');
  });

  test('detects a short CP949 sequence without predecessor-byte signals', () => {
    const bytes = Buffer.from([0xC0, 0xCC, 0xBF, 0xEB, 0xC0, 0xCF]);
    expect(detectEncoding(bytes)).toBe('cp949');
    expect(decodeBuffer(bytes)).toBe('이용일');
  });

  test('returns utf-8 for empty buffer', () => {
    expect(detectEncoding(Buffer.alloc(0))).toBe('utf-8');
  });

  test('returns utf-8 for single-byte buffer', () => {
    expect(detectEncoding(Buffer.from([0x41]))).toBe('utf-8');
  });
});

describe('decodeBuffer', () => {
  test('decodes UTF-8 with BOM', () => {
    const bomUtf8 = Buffer.from([0xEF, 0xBB, 0xBF, ...Buffer.from('Hello')]);
    expect(decodeBuffer(bomUtf8, 'utf-8')).toBe('Hello');
  });

  test('decodes UTF-16 LE with BOM', () => {
    // "Hi" in UTF-16 LE with BOM
    const utf16le = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x69, 0x00]);
    const result = decodeBuffer(utf16le, 'utf-16le');
    expect(result).toBe('Hi');
  });

  test('decodes UTF-16 LE Korean text', () => {
    // "이용일" in UTF-16 LE with BOM
    // 이 = U+C774 → LE: 74 C7, 용 = U+C6A9 → LE: A9 C6, 일 = U+C77C → LE: 7C C7
    const utf16le = Buffer.from([
      0xFF, 0xFE, // BOM
      0x74, 0xC7, 0xA9, 0xC6, 0x7C, 0xC7, // 이용일 in UTF-16 LE
    ]);
    const result = decodeBuffer(utf16le, 'utf-16le');
    expect(result).toContain('이용');
  });

  test('auto-detects and decodes UTF-16 LE', () => {
    const utf16le = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x69, 0x00]);
    expect(decodeBuffer(utf16le)).toBe('Hi');
  });

  test('auto-detects and decodes UTF-8', () => {
    const utf8 = Buffer.from('거래일시,가맹점명', 'utf-8');
    expect(decodeBuffer(utf8)).toBe('거래일시,가맹점명');
  });
});

// ---------------------------------------------------------------------------
// OFX/HTML format detection tests (C98-03/C98-05)
// ---------------------------------------------------------------------------

describe('detectFormat - OFX', () => {
  let temporaryDirectory = '';

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'cherrypicker-parser-detect-ofx-'),
    );
  });

  afterAll(async () => {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('detects OFX from .ofx extension', async () => {
    const filePath = join(temporaryDirectory, 'test.ofx');
    await writeFile(filePath, 'OFXHEADER:100\nDATA:OFXSGML\n');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('ofx');
  });

  test('detects OFX from .qfx extension', async () => {
    const filePath = join(temporaryDirectory, 'test.qfx');
    await writeFile(filePath, 'OFXHEADER:100\nDATA:OFXSGML\n');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('ofx');
  });

  test('detects OFX from content sniffing (<?OFX header)', async () => {
    const filePath = join(temporaryDirectory, 'test.txt');
    await writeFile(filePath, '<?OFX OFXHEADER="200" VERSION="220"?>\n<OFX>\n</OFX>');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('ofx');
  });

  test('detects OFX 2.x from XML content with OFX tags', async () => {
    const filePath = join(temporaryDirectory, 'test.xml');
    await writeFile(filePath, '<?xml version="1.0"?>\n<OFX>\n<BANKTRANLIST>\n</BANKTRANLIST>\n</OFX>');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('ofx');
  });
});

describe('detectFormat - HTML', () => {
  let temporaryDirectory = '';

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'cherrypicker-parser-detect-html-'),
    );
  });

  afterAll(async () => {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('detects HTML from .html extension', async () => {
    const filePath = join(temporaryDirectory, 'test.html');
    await writeFile(filePath, '<html><body><table><tr><td>test</td></tr></table></body></html>');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('html');
  });

  test('detects HTML from .htm extension', async () => {
    const filePath = join(temporaryDirectory, 'test.htm');
    await writeFile(filePath, '<html><body><table><tr><td>test</td></tr></table></body></html>');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('html');
  });

  test('detects HTML from content sniffing (<table tag)', async () => {
    const filePath = join(temporaryDirectory, 'test.txt');
    await writeFile(filePath, '<table><tr><td>test</td></tr></table>');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('html');
  });

  test('detects HTML from <!DOCTYPE html content', async () => {
    const filePath = join(temporaryDirectory, 'test.dat');
    await writeFile(filePath, '<!DOCTYPE html>\n<html><body>test</body></html>');
    const result = await detectFormat(filePath);
    expect(result.format).toBe('html');
  });
});

describe('detectFormat - BOM-aware content sniffing', () => {
  let temporaryDirectory = '';

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'cherrypicker-parser-detect-bom-'),
    );
  });

  afterAll(async () => {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('detects JSON with UTF-8 BOM prefix', async () => {
    const filePath = join(temporaryDirectory, 'bom.json');
    // UTF-8 BOM + valid JSON
    const content = Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from('[{"date":"2024-01-15","amount":10000}]'),
    ]);
    await writeFile(filePath, content);
    const result = await detectFormat(filePath);
    expect(result.format).toBe('json');
  });

  test('detects OFX with BOM prefix', async () => {
    const filePath = join(temporaryDirectory, 'bom.ofx');
    const content = Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from('<?OFX OFXHEADER="200"?>'),
    ]);
    await writeFile(filePath, content);
    const result = await detectFormat(filePath);
    // .ofx extension takes precedence over content sniffing
    expect(result.format).toBe('ofx');
  });
});
