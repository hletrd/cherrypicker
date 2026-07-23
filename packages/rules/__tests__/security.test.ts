import { describe, expect, test } from 'bun:test';
import {
  CARD_ID_MAX_LENGTH,
  cardIdSchema,
  cardMetaSchema,
  issuerMetaSchema,
  issuersFileSchema,
  safeExternalUrl,
  safeExternalUrlSchema,
} from '../src/index.js';

describe('cardIdSchema', () => {
  test('accepts safe hyphenated and dotted catalog IDs', () => {
    for (const value of [
      'shinhan-simple-plan',
      'hana-wonder-2.0',
      'ibk-ibk-point-3.8',
      'a',
    ]) {
      expect(cardIdSchema.safeParse(value).success).toBe(true);
    }
  });

  test('rejects path coordinates and non-slug characters', () => {
    for (const value of [
      '../x',
      'foo/../../x',
      'foo\\..\\x',
      '/tmp/x',
      'C:\\x',
      '.',
      '..',
      '-leading',
      'trailing-',
      '.leading',
      'trailing.',
      'UPPERCASE',
      'white space',
      'nul\u0000byte',
      'percent%2fescape',
      'a'.repeat(CARD_ID_MAX_LENGTH + 1),
    ]) {
      expect(cardIdSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('safeExternalUrl', () => {
  test('returns unchanged absolute HTTP(S) URLs', () => {
    for (const value of [
      'http://example.com/card',
      'https://example.com/card?q=1#benefits',
      'https://xn--3e0b707e/path',
    ]) {
      expect(safeExternalUrl(value)).toBe(value);
      expect(safeExternalUrlSchema.safeParse(value).success).toBe(true);
    }
  });

  test('preserves the absent-value contract', () => {
    expect(safeExternalUrl(undefined)).toBeUndefined();
    expect(safeExternalUrl('')).toBeUndefined();
    expect(safeExternalUrlSchema.safeParse('').success).toBe(true);
  });

  test('rejects executable, relative, credentialed, malformed, and padded URLs', () => {
    for (const value of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'blob:https://example.com/id',
      '//example.com/card',
      '/relative/card',
      'https://user:secret@example.com/card',
      ' https://example.com/card',
      'https://example.com/card ',
      'https://example.com/\ncard',
      'https://example.com/\tcard',
      'https://example.com/\u0000card',
      'not a url',
    ]) {
      expect(safeExternalUrl(value)).toBeUndefined();
      expect(safeExternalUrlSchema.safeParse(value).success).toBe(false);
    }
  });

  test('canonical card metadata uses both security schemas', () => {
    const base = {
      id: 'shinhan-safe-card',
      issuer: 'shinhan',
      name: 'Safe Card',
      nameKo: '안전 카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      lastUpdated: '2026-07-23',
      source: 'manual',
    } as const;

    expect(cardMetaSchema.safeParse({ ...base, url: 'https://example.com/card' }).success).toBe(true);
    expect(cardMetaSchema.safeParse({ ...base, id: '../escape' }).success).toBe(false);
    expect(cardMetaSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false);
  });

  test('requires explicit reviewed provenance before publishing a card source URL', () => {
    const base = {
      id: 'shinhan-safe-card',
      issuer: 'shinhan',
      name: 'Safe Card',
      nameKo: '안전 카드',
      type: 'credit',
      annualFee: { domestic: 0, international: 0 },
      lastUpdated: '2026-07-23',
    } as const;
    const attackerUrl = 'https://attacker.example/phish';

    expect(
      cardMetaSchema.safeParse({
        ...base,
        source: 'llm-scrape',
        url: attackerUrl,
      }).success,
    ).toBe(false);
    expect(
      cardMetaSchema.safeParse({
        ...base,
        source: 'llm-scrape',
      }).success,
    ).toBe(true);
    expect(
      cardMetaSchema.safeParse({
        ...base,
        source: 'llm-scrape',
        url: '',
      }).success,
    ).toBe(true);
    for (const source of ['manual', 'web'] as const) {
      expect(
        cardMetaSchema.safeParse({
          ...base,
          source,
          url: attackerUrl,
        }).success,
      ).toBe(true);
    }
  });

  test('issuer websites require a non-empty safe HTTP(S) URL', () => {
    const base = {
      id: 'shinhan',
      nameKo: '신한카드',
      nameEn: 'Shinhan Card',
    };

    expect(
      issuerMetaSchema.safeParse({
        ...base,
        website: 'https://www.shinhancard.com',
      }).success,
    ).toBe(true);

    for (const website of [
      '',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'https://user:secret@example.com',
      ' https://example.com',
    ]) {
      expect(issuerMetaSchema.safeParse({ ...base, website }).success).toBe(false);
    }
  });

  test('issuer catalog rejects duplicate IDs', () => {
    const issuer = {
      id: 'shinhan',
      nameKo: '신한카드',
      nameEn: 'Shinhan Card',
      website: 'https://www.shinhancard.com',
    };

    expect(
      issuersFileSchema.safeParse({ issuers: [issuer, issuer] }).success,
    ).toBe(false);
  });
});
