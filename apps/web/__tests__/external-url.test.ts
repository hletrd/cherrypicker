import { describe, expect, it } from 'bun:test';
import { safeExternalSourceLink } from '../src/lib/external-url.js';

describe('safeExternalSourceLink', () => {
  it('returns an unchanged safe href and normalized destination hostname', () => {
    const value = 'https://Cards.Example.COM./product?id=1#benefits';
    expect(safeExternalSourceLink(value)).toEqual({
      href: value,
      hostname: 'cards.example.com',
    });
    expect(
      safeExternalSourceLink('http://cards.example.com/product'),
    ).toEqual({
      href: 'http://cards.example.com/product',
      hostname: 'cards.example.com',
    });
  });

  it('treats absent catalog links as absent', () => {
    expect(safeExternalSourceLink(undefined)).toBeUndefined();
    expect(safeExternalSourceLink('')).toBeUndefined();
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
      expect(safeExternalSourceLink(value)).toBeUndefined();
    }
  });
});
