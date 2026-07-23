import { describe, expect, it } from 'bun:test';
import { safeExternalHref } from '../src/lib/external-url.js';

describe('safeExternalHref', () => {
  it('returns an unchanged absolute HTTP(S) URL', () => {
    const value = 'https://cards.example.com/product?id=1#benefits';
    expect(safeExternalHref(value)).toBe(value);
    expect(safeExternalHref('http://cards.example.com/product')).toBe(
      'http://cards.example.com/product',
    );
  });

  it('treats absent catalog links as absent', () => {
    expect(safeExternalHref(undefined)).toBeUndefined();
    expect(safeExternalHref('')).toBeUndefined();
  });

  it('suppresses unsafe and malformed catalog values', () => {
    for (const value of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,unsafe',
      'file:///etc/passwd',
      '//cards.example.com/product',
      '/relative/product',
      'https://user:password@cards.example.com/product',
      ' https://cards.example.com/product',
      'https://cards.example.com/product\n',
      'https://cards.example.com/\u0000product',
    ]) {
      expect(safeExternalHref(value)).toBeUndefined();
    }
  });
});
