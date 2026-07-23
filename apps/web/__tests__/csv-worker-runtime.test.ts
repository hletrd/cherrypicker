import { describe, expect, test } from 'bun:test';
import { parseCSVBuffer } from '../src/lib/parser/csv.js';

function bufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

describe('CSV worker preprocessing runtime', () => {
  test('detects encoding and bank while parsing the transferred bytes', () => {
    const bytes = new TextEncoder().encode(
      '신한카드\n이용일,이용처,이용금액\n2026-07-23,테스트 식당,10000\n',
    );
    const result = parseCSVBuffer(bufferFromBytes(bytes));

    expect(result.bank).toBe('shinhan');
    expect(result.transactions).toHaveLength(1);
    expect(result.textMetadata).toEqual({
      encoding: 'utf-8',
      replacementCount: 0,
      detectedBank: 'shinhan',
    });
  });

  test('preserves an explicit bank override in worker metadata and parsing', () => {
    const bytes = new TextEncoder().encode(
      '신한카드\n이용일,이용처,이용금액\n2026-07-23,테스트 식당,10000\n',
    );
    const result = parseCSVBuffer(bufferFromBytes(bytes), 'kb');

    expect(result.bank).toBe('kb');
    expect(result.textMetadata?.detectedBank).toBe('kb');
  });

  test('returns replacement metadata and a warning from worker preprocessing', () => {
    const bytes = new Uint8Array(2 + (51 * 2));
    bytes[0] = 0xFF;
    bytes[1] = 0xFE;
    for (let index = 0; index < 51; index++) {
      bytes[2 + (index * 2)] = 0x00;
      bytes[3 + (index * 2)] = 0xD8;
    }

    const result = parseCSVBuffer(bufferFromBytes(bytes));

    expect(result.textMetadata).toEqual({
      encoding: 'utf-16le',
      replacementCount: 51,
      detectedBank: null,
    });
    expect(result.errors[0]).toMatchObject({
      code: 'TEXT_ENCODING_REPLACEMENTS',
    });
    expect(result.errors[0]?.message).toContain('인코딩');
  });
});
