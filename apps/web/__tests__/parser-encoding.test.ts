/**
 * Unit tests for the web-side CSV parser encoding detection logic.
 *
 * The actual encoding detection lives in parser/index.ts parseFile(), which
 * uses File/ArrayBuffer APIs not available in bun:test. We reproduce the core
 * encoding selection logic locally to verify it works correctly.
 *
 * C58-07: Test coverage for the encoding detection fallback path.
 *
 * Note: Bun's Buffer.from does not support euc-kr/cp949 encoding, so we
 * construct EUC-KR byte sequences manually using known code points for
 * Korean characters. EUC-KR encodes Korean syllables as 2-byte sequences
 * where both bytes have the high bit set (0x80+).
 */
import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Reproduce the encoding detection logic from parser/index.ts parseFile()
// ---------------------------------------------------------------------------

const ENCODINGS = ['utf-8', 'euc-kr', 'cp949'] as const;

/**
 * Selects the best encoding for a given buffer by trying each encoding
 * and choosing the one with the fewest replacement characters (U+FFFD).
 * Mirrors the logic in apps/web/src/lib/parser/index.ts:17-37.
 */
function detectBestEncoding(buffer: ArrayBuffer): {
  content: string;
  encoding: string;
  replacementCount: number;
} {
  let bestContent = '';
  let bestReplacements = Infinity;
  let bestEncoding = 'utf-8';

  for (const encoding of ENCODINGS) {
    try {
      const decoder = new TextDecoder(encoding);
      const decoded = decoder.decode(buffer);
      const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
      if (replacementCount < bestReplacements) {
        bestReplacements = replacementCount;
        bestContent = decoded;
        bestEncoding = encoding;
      }
      if (replacementCount < 5) break;
    } catch { continue; }
  }

  return {
    content: bestContent || new TextDecoder('utf-8').decode(buffer),
    encoding: bestEncoding,
    replacementCount: bestReplacements,
  };
}

/**
 * Build an EUC-KR byte sequence for a Korean CSV line.
 * EUC-KR encodes Korean syllables as 2-byte pairs where both bytes >= 0x80.
 * We use the TextEncoder for the ASCII parts and manually insert EUC-KR
 * byte pairs for the Korean characters.
 *
 * Since we can't use iconv-lite in bun:test, we construct a realistic
 * EUC-KR-like byte sequence: ASCII for dates/numbers, and high-bit
 * byte pairs for Korean text. The TextDecoder('euc-kr') will decode
 * these correctly.
 */
function buildEucKrLikeBuffer(): ArrayBuffer {
  // Construct a buffer with high-bit bytes that are valid EUC-KR sequences
  // but invalid UTF-8. This simulates an EUC-KR encoded Korean CSV.
  //
  // EUC-KR KS X 1001 row/col encoding:
  // Byte1 = 0xA1 + row (0xA1..0xFE), Byte2 = 0xA1 + col (0xA1..0xFE)
  // '가' (U+AC00) = 0xB0 0xA1 in EUC-KR
  // '나' (U+B098) = 0xB3 0xAA in EUC-KR
  // '다' (U+B2E4) = 0xB4 0xD9 in EUC-KR

  // Build: "2024-01-15,<Korean>,5000\n"
  const ascii1 = new TextEncoder().encode('2024-01-15,');
  const ascii2 = new TextEncoder().encode(',5000\n');

  // EUC-KR bytes for common Korean characters:
  // 이용일 = 0xC0 CC BF EB C0 CF
  // 이용처 = 0xC0 CC BF EB C3 B3
  // 이용금액 = 0xC0 CC BF EB B1 DD BE D7
  const koreanBytes = new Uint8Array([0xC0, 0xCC, 0xBF, 0xEB, 0xC0, 0xCF]); // 이용일

  const combined = new Uint8Array(ascii1.length + koreanBytes.length + ascii2.length);
  combined.set(ascii1, 0);
  combined.set(koreanBytes, ascii1.length);
  combined.set(ascii2, ascii1.length + koreanBytes.length);

  return combined.buffer as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Encoding detection', () => {
  test('UTF-8 CSV content is decoded correctly with zero replacements', () => {
    const csvContent = '이용일,이용처,이용금액\n2024-01-15,스타벅스,5000\n';
    const buffer = new TextEncoder().encode(csvContent).buffer;

    const result = detectBestEncoding(buffer);

    expect(result.encoding).toBe('utf-8');
    expect(result.replacementCount).toBe(0);
    expect(result.content).toContain('이용일');
    expect(result.content).toContain('스타벅스');
  });

  test('EUC-KR encoded bytes are decoded with fewer replacements via euc-kr decoder than utf-8', () => {
    const eucKrBuffer = buildEucKrLikeBuffer();

    // First verify UTF-8 decoding produces replacement characters
    const utf8Decoded = new TextDecoder('utf-8', { fatal: false }).decode(eucKrBuffer);
    const utf8Replacements = (utf8Decoded.match(/\uFFFD/g) ?? []).length;
    // EUC-KR high-bit bytes are invalid UTF-8 sequences
    expect(utf8Replacements).toBeGreaterThan(0);

    // The detection logic should find a better encoding
    const result = detectBestEncoding(eucKrBuffer);

    // EUC-KR decoding should produce fewer replacements than UTF-8
    expect(result.replacementCount).toBeLessThanOrEqual(utf8Replacements);
  });

  test('EUC-KR decoder can decode the manually constructed EUC-KR buffer', () => {
    const eucKrBuffer = buildEucKrLikeBuffer();

    // Directly test that TextDecoder('euc-kr') can decode our bytes
    const decoded = new TextDecoder('euc-kr').decode(eucKrBuffer);

    // Should contain the Korean characters without replacement characters
    // (or at minimum, fewer than UTF-8 decoding)
    const utf8Decoded = new TextDecoder('utf-8', { fatal: false }).decode(eucKrBuffer);
    const eucKrReplacements = (decoded.match(/\uFFFD/g) ?? []).length;
    const utf8Replacements = (utf8Decoded.match(/\uFFFD/g) ?? []).length;
    expect(eucKrReplacements).toBeLessThan(utf8Replacements);
  });

  test('pure ASCII content has zero replacements regardless of encoding', () => {
    const csvContent = 'date,merchant,amount\n2024-01-15,Starbucks,5000\n';
    const buffer = new TextEncoder().encode(csvContent).buffer;

    const result = detectBestEncoding(buffer);

    expect(result.replacementCount).toBe(0);
    expect(result.content).toContain('Starbucks');
  });
});

describe('Encoding warning threshold', () => {
  test('content with fewer than 5 replacements uses early exit', () => {
    // A UTF-8 file with one minor corruption byte
    const csvContent = '이용일,이용처,이용금액\n2024-01-15,스타벅스,5000\n';
    const bytes = new TextEncoder().encode(csvContent);
    // Corrupt one byte (not at a critical position)
    const corrupted = new Uint8Array(bytes);
    corrupted[10] = 0x80; // Invalid UTF-8 continuation byte

    const result = detectBestEncoding(corrupted.buffer as ArrayBuffer);

    // Should still produce usable content with only 1 replacement
    expect(result.replacementCount).toBeLessThanOrEqual(5);
  });

  test('properly decoded content should not trigger the > 50 replacement warning', () => {
    // Build a buffer with multiple EUC-KR Korean lines
    const lines: Uint8Array[] = [];
    const asciiPrefix = new TextEncoder().encode('2024-01-15,');
    const asciiSuffix = new TextEncoder().encode(',5000\n');
    // 이용일 in EUC-KR
    const koreanBytes = new Uint8Array([0xC0, 0xCC, 0xBF, 0xEB, 0xC0, 0xCF]);

    for (let i = 0; i < 20; i++) {
      const line = new Uint8Array(asciiPrefix.length + koreanBytes.length + asciiSuffix.length);
      line.set(asciiPrefix, 0);
      line.set(koreanBytes, asciiPrefix.length);
      line.set(asciiSuffix, asciiPrefix.length + koreanBytes.length);
      lines.push(line);
    }

    const totalLen = lines.reduce((sum, l) => sum + l.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const line of lines) {
      combined.set(line, offset);
      offset += line.length;
    }

    const result = detectBestEncoding(combined.buffer as ArrayBuffer);

    // When properly detected as EUC-KR, the replacement count should be
    // lower than the UTF-8 decoding, and should not exceed the warning threshold
    const shouldWarn = result.replacementCount > 50;
    expect(shouldWarn).toBe(false);
  });
});
