import { describe, expect, test } from 'bun:test';
import {
  decodeTextBytes,
  detectTextEncoding,
} from '@cherrypicker/parser/browser';

function cp949CSV(): Uint8Array {
  const prefix = new TextEncoder().encode('date,merchant,amount\n2024-01-15,');
  const suffix = new TextEncoder().encode(',5000\n');
  // "이용일" in CP949/EUC-KR. This sequence exposed the old predecessor-byte
  // heuristic because its continuation-range bytes do not follow ASCII.
  const korean = new Uint8Array([0xC0, 0xCC, 0xBF, 0xEB, 0xC0, 0xCF]);
  const bytes = new Uint8Array(prefix.length + korean.length + suffix.length);
  bytes.set(prefix);
  bytes.set(korean, prefix.length);
  bytes.set(suffix, prefix.length + korean.length);
  return bytes;
}

describe('production encoding detection', () => {
  test('keeps valid Korean UTF-8 as UTF-8', () => {
    const bytes = new TextEncoder().encode('이용일,이용처,이용금액');
    expect(detectTextEncoding(bytes)).toBe('utf-8');
    expect(decodeTextBytes(bytes)).toContain('이용일');
  });

  test('detects and decodes short CP949 Korean text', () => {
    const bytes = cp949CSV();
    expect(detectTextEncoding(bytes)).toBe('cp949');
    expect(decodeTextBytes(bytes)).toContain('이용일');
    expect(decodeTextBytes(bytes)).not.toContain('\uFFFD');
  });

  test('honors UTF-16 BOMs', () => {
    expect(detectTextEncoding(new Uint8Array([0xFF, 0xFE, 0x41, 0x00]))).toBe('utf-16le');
    expect(detectTextEncoding(new Uint8Array([0xFE, 0xFF, 0x00, 0x41]))).toBe('utf-16be');
  });

  test('uses UTF-8 for pure ASCII', () => {
    const bytes = new TextEncoder().encode('date,merchant,amount');
    expect(detectTextEncoding(bytes)).toBe('utf-8');
  });
});
