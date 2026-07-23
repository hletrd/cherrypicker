import { describe, expect, test } from 'bun:test';

import {
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
});
