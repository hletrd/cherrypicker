import { describe, expect, test } from 'bun:test';
import type { CategoryNode } from '@cherrypicker/rules';
import { MerchantMatcher } from '../src/categorizer/matcher.js';
import {
  compileNormalizedMerchantTerm,
  compiledNormalizedMerchantTermMatches,
  normalizedMerchantTermMatches,
} from '../src/categorizer/normalize.js';
import { CategoryTaxonomy } from '../src/categorizer/taxonomy.js';

const boundaryFixture: CategoryNode[] = [
  {
    id: 'convenience_store',
    labelKo: '편의점',
    labelEn: 'Convenience Store',
    keywords: ['CU'],
  },
  {
    id: 'telecom',
    labelKo: '통신',
    labelEn: 'Telecom',
    keywords: ['KT', 'SKT'],
  },
  {
    id: 'dining',
    labelKo: '외식',
    labelEn: 'Dining',
    keywords: ['스타벅스'],
  },
];

describe('Cycle 11 compiled merchant boundary metadata', () => {
  test('compiles immutable ASCII edge requirements once per normalized term', () => {
    const compiledCu = compileNormalizedMerchantTerm('cu');
    expect(compiledCu).toEqual({
      text: 'cu',
      requiresLeadingAsciiBoundary: true,
      requiresTrailingAsciiBoundary: true,
    });
    expect(Object.isFrozen(compiledCu)).toBe(true);
    expect(compileNormalizedMerchantTerm('스타벅스')).toEqual({
      text: '스타벅스',
      requiresLeadingAsciiBoundary: false,
      requiresTrailingAsciiBoundary: false,
    });
    expect(compileNormalizedMerchantTerm('-kt')).toEqual({
      text: '-kt',
      requiresLeadingAsciiBoundary: false,
      requiresTrailingAsciiBoundary: true,
    });
    expect(compileNormalizedMerchantTerm('skt-')).toEqual({
      text: 'skt-',
      requiresLeadingAsciiBoundary: true,
      requiresTrailingAsciiBoundary: false,
    });
  });

  test('preserves short-alias, Korean substring, and repeated-occurrence semantics', () => {
    const cases = [
      ['cu 서울점', 'cu', true],
      ['(cu)편의점', 'cu', true],
      ['kt 로밍', 'kt', true],
      ['skt텔레콤', 'skt', true],
      ['culture center', 'cu', false],
      ['booktown', 'kt', false],
      ['sktech', 'skt', false],
      ['서울 스타벅스 강남점', '스타벅스', true],
      ['cux cu', 'cu', true],
      ['cux culture', 'cu', false],
    ] as const;

    for (const [merchant, term, expected] of cases) {
      expect(
        compiledNormalizedMerchantTermMatches(
          merchant,
          compileNormalizedMerchantTerm(term),
        ),
        `${merchant} / ${term}`,
      ).toBe(expected);
      expect(
        normalizedMerchantTermMatches(merchant, term),
        `string API: ${merchant} / ${term}`,
      ).toBe(expected);
    }
  });

  test('does no boundary work when the compiled term does not occur', () => {
    const term = compileNormalizedMerchantTerm('cu');
    const originalRegExpTest = RegExp.prototype.test;
    const originalCharCodeAt = String.prototype.charCodeAt;
    let regexpTests = 0;
    let characterReads = 0;
    let result = true;

    RegExp.prototype.test = function test(value: string): boolean {
      regexpTests += 1;
      return originalRegExpTest.call(this, value);
    };
    String.prototype.charCodeAt = function charCodeAt(index: number): number {
      characterReads += 1;
      return originalCharCodeAt.call(this, index);
    };
    try {
      result = compiledNormalizedMerchantTermMatches(
        'unrelated merchant',
        term,
      );
    } finally {
      RegExp.prototype.test = originalRegExpTest;
      String.prototype.charCodeAt = originalCharCodeAt;
    }

    expect(result).toBe(false);
    expect(regexpTests).toBe(0);
    expect(characterReads).toBe(0);
  });

  test('compiles the normalized merchant once across full forward and reverse scans', () => {
    const matcher = new MerchantMatcher(boundaryFixture);
    const originalRegExpTest = RegExp.prototype.test;
    const originalCharCodeAt = String.prototype.charCodeAt;
    let regexpTests = 0;
    let characterReads = 0;
    let result: ReturnType<MerchantMatcher['match']> | undefined;

    RegExp.prototype.test = function test(value: string): boolean {
      regexpTests += 1;
      return originalRegExpTest.call(this, value);
    };
    String.prototype.charCodeAt = function charCodeAt(index: number): number {
      characterReads += 1;
      return originalCharCodeAt.call(this, index);
    };
    try {
      result = matcher.match('\ue000\ue100\uefff');
    } finally {
      RegExp.prototype.test = originalRegExpTest;
      String.prototype.charCodeAt = originalCharCodeAt;
    }

    expect(result).toEqual({ category: 'uncategorized', confidence: 0 });
    expect(regexpTests).toBe(0);
    expect(characterReads).toBe(2);
  });

  test('matcher and taxonomy retain the Cycle 10 alias matrix', () => {
    const matcher = new MerchantMatcher(boundaryFixture);
    const taxonomy = new CategoryTaxonomy(boundaryFixture);
    const intended = [
      ['CU 서울점', 'convenience_store'],
      ['(cu)편의점', 'convenience_store'],
      ['KT 로밍', 'telecom'],
      ['skt텔레콤', 'telecom'],
    ] as const;
    const collisions = [
      'SECURITY SERVICE',
      'CULTURE CENTER',
      'CUBAN RESTAURANT',
      'SKTECH',
      'BOOKTOWN',
    ] as const;

    for (const [merchant, category] of intended) {
      expect(matcher.match(merchant).category, merchant).toBe(category);
      expect(taxonomy.findCategory(merchant).category, merchant).toBe(category);
    }
    for (const merchant of collisions) {
      expect(matcher.match(merchant).category, merchant).toBe('uncategorized');
      expect(taxonomy.findCategory(merchant).category, merchant).toBe(
        'uncategorized',
      );
    }
  });
});
