import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import { CategoryTaxonomy } from '../src/categorizer/taxonomy.js';
import { MerchantMatcher } from '../src/categorizer/matcher.js';
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

  test('case-insensitive matching', () => {
    // 'cgv' lowercase — keyword is 'CGV' in yaml, stored lowercase in map
    const result = taxonomy.findCategory('cgv');
    expect(result.category).toBe('entertainment');
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

  test('이마트 maps to grocery.supermarket', () => {
    const result = matcher.match('이마트');
    expect(result.category).toBe('grocery');
    expect(result.subcategory).toBe('supermarket');
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

  test('카카오택시 maps to public_transit.taxi', () => {
    const result = matcher.match('카카오택시');
    expect(result.category).toBe('public_transit');
    expect(result.subcategory).toBe('taxi');
    expect(result.confidence).toBe(1.0);
  });

  test('배달의민족 maps to dining.delivery', () => {
    const result = matcher.match('배달의민족');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('delivery');
  });

  test('쿠팡 maps to online_shopping.general', () => {
    const result = matcher.match('쿠팡');
    expect(result.category).toBe('online_shopping');
    expect(result.subcategory).toBe('general');
  });

  test('맥도날드 maps to dining.fastfood', () => {
    const result = matcher.match('맥도날드');
    expect(result.category).toBe('dining');
    expect(result.subcategory).toBe('fastfood');
  });

  test('넷플릭스 maps to entertainment.streaming', () => {
    const result = matcher.match('넷플릭스');
    expect(result.category).toBe('entertainment');
    expect(result.subcategory).toBe('streaming');
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
    const result = matcher.match('신라면세점');
    expect(result.category).toBe('offline_shopping');
    expect(result.subcategory).toBeUndefined();
    expect(result.confidence).toBe(0.8);
  });
});

describe('MerchantMatcher - rawCategory fallback', () => {
  test('uses rawCategory when no static or taxonomy match', () => {
    const result = matcher.match('완전히알수없는가맹점999', '카페');
    expect(result.category).toBe('카페');
    expect(result.confidence).toBe(0.5);
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
