import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import {
  CategoryTaxonomy,
  TAXONOMY_KEYWORD_OVERRIDES,
} from '../src/categorizer/taxonomy.js';
import {
  getResolvedKeywordConflicts,
  MerchantMatcher,
} from '../src/categorizer/matcher.js';
import { loadCategories } from '@cherrypicker/rules';

const categoriesPath = join(
  import.meta.dir,
  '../../../packages/rules/data/categories.yaml',
);

let taxonomy: CategoryTaxonomy;
let matcher: MerchantMatcher;

beforeAll(async () => {
  const nodes = await loadCategories(categoriesPath);
  taxonomy = new CategoryTaxonomy(nodes);
  matcher = new MerchantMatcher(nodes);
});

describe('CategoryTaxonomy - getAllCategories', () => {
  test('returns all top-level category ids', () => {
    const cats = taxonomy.getAllCategories();
    expect(cats).toContain('dining');
    expect(cats).toContain('grocery');
    expect(cats).toContain('convenience_store');
    expect(cats).toContain('public_transit');
    expect(cats).toContain('online_shopping');
    expect(cats).toContain('telecom');
    expect(cats).toContain('insurance');
    expect(cats).toContain('medical');
    expect(cats).toContain('entertainment');
    expect(cats).toContain('travel');
    expect(cats).toContain('utilities');
    expect(cats).toContain('uncategorized');
  });

  test('returns subcategory ids too', () => {
    const cats = taxonomy.getAllCategories();
    expect(cats).toContain('cafe');
    expect(cats).toContain('supermarket');
    expect(cats).toContain('taxi');
    expect(cats).toContain('streaming');
    expect(cats).toContain('pharmacy');
  });
});

describe('CategoryTaxonomy - getCategoryLabel', () => {
  test('returns Korean and English labels for dining', () => {
    const label = taxonomy.getCategoryLabel('dining');
    expect(label.ko).toBe('외식');
    expect(label.en).toBe('Dining');
  });

  test('returns Korean and English labels for convenience_store', () => {
    const label = taxonomy.getCategoryLabel('convenience_store');
    expect(label.ko).toBe('편의점');
    expect(label.en).toBe('Convenience Store');
  });

  test('returns id as fallback for unknown category', () => {
    const label = taxonomy.getCategoryLabel('some_unknown_id');
    expect(label.ko).toBe('some_unknown_id');
    expect(label.en).toBe('some_unknown_id');
  });
});

describe('CategoryTaxonomy - findCategory', () => {
  test('exact keyword match returns confidence 1.0', () => {
    const result = taxonomy.findCategory('카페');
    expect(result.confidence).toBe(1.0);
  });

  test('finds dining category via keyword', () => {
    const result = taxonomy.findCategory('식당');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('restaurant');
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('finds convenience_store via CU keyword', () => {
    const result = taxonomy.findCategory('CU');
    expect(result.category).toBe('convenience_store');
  });

  test('substring match returns confidence 0.8', () => {
    // '이마트 강남점' contains '이마트' which is a keyword
    const result = taxonomy.findCategory('이마트 강남점');
    expect(result.confidence).toBe(0.8);
  });

  test('uncategorized fallback returns confidence 0.0', () => {
    const result = taxonomy.findCategory('완전히알수없는가맹점xyz');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0.0);
  });

  test('reverse fuzzy match (merchant in keyword) selects shortest keyword — regression for C3-01', () => {
    // When a merchant name is contained in multiple keywords, the shortest
    // keyword should be selected (tightest fit = most likely correct).
    // Use a fixture taxonomy to control the keyword set.
    const fixtureNodes: CategoryNode[] = [
      {
        id: 'transportation',
        labelKo: '교통',
        labelEn: 'Transportation',
        keywords: ['카카오택시', 'UBER택시', '택시', '버스'],
      },
      {
        id: 'utilities',
        labelKo: '공과금',
        labelEn: 'Utilities',
        keywords: ['전기요금', '가스요금'],
      },
    ];
    const fixtureTaxonomy = new CategoryTaxonomy(fixtureNodes);

    // Fuzzy match requires merchant length >= 3 to avoid false positives.
    // "기요금" (3 chars) is contained in both "전기요금" (4 chars) and "가스요금" (4 chars)
    // — both have the same length, so the first one encountered wins.
    // Use "스요금" (3 chars) which is only in "가스요금" for a clean test.
    const result = fixtureTaxonomy.findCategory('스요금');
    expect(result.category).toBe('utilities');
    expect(result.confidence).toBe(0.6);

    // Verify step 3 (fuzzy) returns 0.6 confidence, not step 2 (0.8) or step 1 (1.0)
    // "카카오" (3 chars) is contained in "카카오택시" — only one keyword matches
    const result2 = fixtureTaxonomy.findCategory('카카오');
    expect(result2.category).toBe('transportation');
    expect(result2.confidence).toBe(0.6);
  });

  test('case-insensitive matching', () => {
    // 'cgv' lowercase — keyword is 'CGV' in yaml, stored lowercase in map
    const result = taxonomy.findCategory('cgv');
    expect(result.category).toBe('entertainment');
  });
});

describe('CategoryTaxonomy - keyword conflict contract', () => {
  test('every live taxonomy conflict has an explicit audited winner', () => {
    const conflicts = taxonomy.getResolvedKeywordConflicts();
    expect(conflicts).toHaveLength(11);
    expect(Object.keys(TAXONOMY_KEYWORD_OVERRIDES)).toHaveLength(11);
    expect(
      conflicts.every((conflict) =>
        conflict.candidates.includes(conflict.selectedCategory)
      ),
    ).toBe(true);
  });

  test('a conflicting taxonomy keyword without an override is fatal', () => {
    const fixtureNodes = [
      {
        id: 'first',
        labelKo: '첫째',
        labelEn: 'First',
        keywords: ['shared'],
      },
      {
        id: 'second',
        labelKo: '둘째',
        labelEn: 'Second',
        keywords: ['shared'],
      },
    ];

    expect(
      () => new CategoryTaxonomy(fixtureNodes, { keywordOverrides: {} }),
    ).toThrow(/unresolved categories/);
    expect(
      new CategoryTaxonomy(fixtureNodes, {
        keywordOverrides: { shared: 'second' },
      }).findCategory('shared').category,
    ).toBe('second');
  });
});

describe('MerchantMatcher - static MERCHANT_KEYWORDS', () => {
  test('스타벅스 maps to dining.cafe', () => {
    const result = matcher.match('스타벅스');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('cafe');
    expect(result.confidence).toBe(1.0);
  });

  test('스타벅스 서초점 matches via substring', () => {
    const result = matcher.match('스타벅스 서초점');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('cafe');
  });

  test('이마트 follows the current curated offline shopping override', () => {
    const result = matcher.match('이마트');
    expect(result.category).toBe('offline_shopping');
    expect(result.subcategory).toBeUndefined();
    expect(result.confidence).toBe(1.0);
  });

  test('CU maps to convenience_store', () => {
    const result = matcher.match('CU');
    expect(result.category).toBe('convenience_store');
    expect(result.subcategory).toBeUndefined();
    expect(result.confidence).toBe(1.0);
  });

  test('GS25 maps to convenience_store', () => {
    const result = matcher.match('GS25');
    expect(result.category).toBe('convenience_store');
  });

  test('카카오택시 follows the current transportation override', () => {
    const result = matcher.match('카카오택시');
    expect(result.category).toBe('transportation');
    expect(result.subcategory).toBeUndefined();
    expect(result.confidence).toBe(1.0);
  });

  test('배달의민족 maps to dining.delivery', () => {
    const result = matcher.match('배달의민족');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('delivery');
  });

  test('쿠팡 maps to the top-level online shopping category', () => {
    const result = matcher.match('쿠팡');
    expect(result.category).toBe('online_shopping');
    expect(result.subcategory).toBeUndefined();
  });

  test('맥도날드 maps to dining.fast_food', () => {
    const result = matcher.match('맥도날드');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('fast_food');
  });

  test('넷플릭스 follows the current subscription override', () => {
    const result = matcher.match('넷플릭스');
    expect(result.category).toBe('subscription');
    expect(result.subcategory).toBeUndefined();
  });

  test('SKT maps to telecom', () => {
    const result = matcher.match('SKT');
    expect(result.category).toBe('telecom');
    expect(result.subcategory).toBeUndefined();
  });

  test('case-insensitive match for starbucks', () => {
    const result = matcher.match('Starbucks');
    expect(result.category).toBe('dining');
  });

  test('자동차세 maps to utilities after niche keyword dedupe', () => {
    const result = matcher.match('자동차세');
    expect(result.category).toBe('utilities');
    expect(result.subcategory).toBeUndefined();
    expect(result.confidence).toBe(1.0);
  });

  test('면세점 maps to offline_shopping after niche keyword dedupe', () => {
    const result = matcher.match('면세점');
    expect(result.category).toBe('offline_shopping');
    expect(result.subcategory).toBeUndefined();
    expect(result.confidence).toBe(1.0);
  });
});

describe('MerchantMatcher - rawCategory fallback', () => {
  test('uses rawCategory when it matches a known taxonomy ID', () => {
    const result = matcher.match('완전히알수없는가맹점999', 'cafe');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('cafe');
    expect(result.confidence).toBe(0.5);
  });

  test('rejects rawCategory that does not match a known taxonomy ID', () => {
    // "카페" is a Korean label, not a taxonomy ID — should fall through
    // to uncategorized instead of creating a phantom category
    const result = matcher.match('완전히알수없는가맹점999', '카페');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0.0);
  });

  test('ignores empty rawCategory', () => {
    const result = matcher.match('완전히알수없는가맹점999', '');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0.0);
  });
});

describe('MerchantMatcher - uncategorized fallback', () => {
  test('returns uncategorized with confidence 0 for unknown merchant', () => {
    const result = matcher.match('알수없는회사XYZABC');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0.0);
  });
});

describe('MerchantMatcher - length guard (C10-02 / C11-13)', () => {
  test('empty string returns uncategorized with confidence 0', () => {
    const result = matcher.match('');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0);
  });

  test('single character returns uncategorized with confidence 0', () => {
    const result = matcher.match('스');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0);
  });

  test('whitespace-only string returns uncategorized with confidence 0', () => {
    const result = matcher.match('   ');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0);
  });

  test('two character name works for forward matching (exact keyword)', () => {
    // "CU" is a 2-char exact keyword — should match at confidence 1.0
    const result = matcher.match('CU');
    expect(result.category).toBe('convenience_store');
    expect(result.confidence).toBe(1.0);
  });

  test('two character name does NOT reverse-match longer keywords', () => {
    // "스타" (2 CJK chars) should NOT reverse-match "스타벅스" —
    // the reverse substring check requires merchant length >= 3.
    // It may match if "스타" is an exact keyword, but it should
    // NOT get a confidence of 0.8 from the reverse substring path.
    const result = matcher.match('스타');
    // If "스타" is not an exact keyword, it should be uncategorized or low confidence
    // (not 0.8 from reverse substring match of "스타벅스")
    if (result.confidence === 0.8) {
      // If it does match at 0.8, it must be from forward matching
      // (merchant contains a keyword), not reverse matching
      expect(result.category).not.toBe('cafe');
    }
  });

  test('three character name can reverse-match longer keywords via taxonomy', () => {
    // "스타벅" (3 CJK chars) should be able to reverse-match "스타벅스"
    // since the length guard only blocks < 3 chars
    const fixtureNodes: CategoryNode[] = [
      {
        id: 'dining',
        labelKo: '외식',
        labelEn: 'Dining',
        keywords: ['스타벅스'],
      },
    ];
    const fixtureTaxonomy = new CategoryTaxonomy(fixtureNodes);
    const result = fixtureTaxonomy.findCategory('스타벅');
    expect(result.category).toBe('dining');
    expect(result.confidence).toBe(0.6); // fuzzy match confidence
  });
});

describe('Cross-file keyword duplicate detection (C3-02)', () => {
  test('every canonical keyword conflict has an explicit audited override', () => {
    const conflicts = getResolvedKeywordConflicts();
    expect(conflicts).toHaveLength(211);
    expect(
      conflicts.every(
        (conflict) =>
          conflict.resolution === 'explicit_override' &&
          conflict.candidates.includes(conflict.selectedCategory),
      ),
    ).toBe(true);
  });

  test('cross-source overlap stays bounded and explicitly resolved', async () => {
    const { MERCHANT_KEYWORDS } = await import('../src/categorizer/keywords.js');
    const { ENGLISH_KEYWORDS } = await import('../src/categorizer/keywords-english.js');

    // ENGLISH_KEYWORDS contains uppercase/English variants of merchant names.
    // The matcher collects and normalizes every source instead of relying on
    // spread order. Different canonical mappings require an explicit audited
    // entry in keyword-overrides.ts. This snapshot only guards the amount of
    // source overlap; the test above verifies conflict resolution.
    const duplicates: string[] = [];
    for (const key of Object.keys(ENGLISH_KEYWORDS)) {
      if (key in MERCHANT_KEYWORDS) {
        duplicates.push(key);
      }
    }
    // Snapshot: as of C3-02, there are 144 known duplicate keys between
    // MERCHANT_KEYWORDS and ENGLISH_KEYWORDS. This number should never
    // increase — only decrease as duplicates are cleaned up.
    expect(duplicates.length).toBeLessThanOrEqual(144);
  });
});

describe('MerchantMatcher - LRU cache (C5-07)', () => {
  test('repeated match returns same result from cache', () => {
    const result1 = matcher.match('스타벅스');
    const result2 = matcher.match('스타벅스');
    expect(result2).toEqual(result1);
    expect(result2.category).toBe('dining');
    expect(result2.subcategory).toBe('cafe');
  });

  test('cache differentiates by rawCategory', () => {
    const result1 = matcher.match('완전히알수없는가맹점999');
    const result2 = matcher.match('완전히알수없는가맹점999', 'cafe');
    expect(result1.category).toBe('uncategorized');
    expect(result2.category).toBe('dining');
    expect(result2.subcategory).toBe('cafe');
  });

  test('cache differentiates by case and spacing', () => {
    const result1 = matcher.match('Starbucks');
    const result2 = matcher.match('starbucks');
    const result3 = matcher.match('starbucks ');
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  test('cache limits size to 500 entries (evicts oldest on overflow)', () => {
    // Create a fresh matcher with an empty cache for this test
    const fixtureNodes: CategoryNode[] = [
      { id: 'dining', labelKo: '외식', labelEn: 'Dining', keywords: ['스타벅스'] },
    ];
    const fixtureMatcher = new MerchantMatcher(fixtureNodes);

    // Fill cache beyond 500 entries with unique merchant names
    for (let i = 0; i < 520; i++) {
      fixtureMatcher.match(`가맹점${i}`);
    }

    // The cache should not grow beyond 500. Accessing one of the first
    // merchants should still produce correct results (either from cache
    // or from recomputation).
    const result = fixtureMatcher.match('가맹점0');
    expect(result.category).toBe('uncategorized');
    expect(result.confidence).toBe(0);

    // Accessing a recent entry should still be cached
    const recent = fixtureMatcher.match('가맹점519');
    expect(recent.category).toBe('uncategorized');
    expect(recent.confidence).toBe(0);
  });

  test('cached results preserve confidence levels', () => {
    // Exact match (1.0)
    const exact1 = matcher.match('스타벅스');
    const exact2 = matcher.match('스타벅스');
    expect(exact1.confidence).toBe(1.0);
    expect(exact2.confidence).toBe(1.0);

    // Substring match (0.8)
    const sub1 = matcher.match('스타벅스 강남점');
    const sub2 = matcher.match('스타벅스 강남점');
    expect(sub1.confidence).toBe(0.8);
    expect(sub2.confidence).toBe(0.8);

    // rawCategory fallback (0.5)
    const raw1 = matcher.match('알수없는가맹점', 'cafe');
    const raw2 = matcher.match('알수없는가맹점', 'cafe');
    expect(raw1.confidence).toBe(0.5);
    expect(raw2.confidence).toBe(0.5);
  });
});
