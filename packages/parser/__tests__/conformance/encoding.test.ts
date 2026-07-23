import { describe, expect, test } from 'bun:test';

import {
  decodeStatementTextBytes,
  decodeTextBytes,
  detectTextEncoding,
} from '../../src/browser.js';

import { longCP949CSV, shortCP949CSV } from './encoding-fixtures.js';

describe('shared text encoding kernel', () => {
  test.each([
    ['short', shortCP949CSV()],
    ['long', longCP949CSV()],
  ])('decodes %s BOM-free CP949 bytes', (_name, bytes) => {
    expect(detectTextEncoding(bytes)).toBe('cp949');
    expect(decodeTextBytes(bytes)).toContain('이용일');
    expect(decodeTextBytes(bytes)).not.toContain('\uFFFD');
  });

  test('keeps valid Korean UTF-8 and ASCII as UTF-8', () => {
    expect(detectTextEncoding(new TextEncoder().encode('이용일'))).toBe('utf-8');
    expect(detectTextEncoding(new TextEncoder().encode('date'))).toBe('utf-8');
  });

  test.each([
    ['json', '[{"date":"2026-07-24","merchant":"가맹점","amount":10000}]'],
    ['ofx', '<OFX><CURDEF>KRW</CURDEF></OFX>'],
    ['html', '<html><body>가맹점</body></html>'],
  ] as const)(
    'decodes common UTF-8 %s payloads in one whole-input pass',
    (format, content) => {
      const originalDecode = TextDecoder.prototype.decode;
      let decodeCalls = 0;
      TextDecoder.prototype.decode = function (
        ...args: Parameters<TextDecoder['decode']>
      ): string {
        decodeCalls++;
        return originalDecode.apply(this, args);
      };

      try {
        expect(
          decodeStatementTextBytes(new TextEncoder().encode(content), format),
        ).toBe(content);
        expect(decodeCalls).toBe(1);
      } finally {
        TextDecoder.prototype.decode = originalDecode;
      }
    },
  );
});
