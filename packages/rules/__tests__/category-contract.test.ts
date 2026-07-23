import { describe, expect, test } from 'bun:test';
import { CategoryRegistry, canonicalizeCategory } from '../src/category-contract.js';
import type { CategoryNode } from '../src/types.js';

const nodes: CategoryNode[] = [
  {
    id: 'dining',
    labelKo: '외식',
    labelEn: 'Dining',
    keywords: [],
    subcategories: [
      { id: 'cafe', labelKo: '카페', labelEn: 'Cafe', keywords: [] },
    ],
  },
  {
    id: 'shopping',
    labelKo: '쇼핑',
    labelEn: 'Shopping',
    keywords: [],
    subcategories: [
      { id: 'cafe', labelKo: '카페 상품', labelEn: 'Cafe goods', keywords: [] },
    ],
  },
  {
    id: 'utilities',
    labelKo: '공과금',
    labelEn: 'Utilities',
    keywords: [],
  },
];

describe('CategoryRegistry', () => {
  test('resolves parents and qualified children canonically', () => {
    const registry = new CategoryRegistry(nodes);
    expect(registry.resolve('utilities').value).toEqual({ category: 'utilities' });
    expect(registry.resolve('dining.cafe').value).toEqual({
      category: 'dining',
      subcategory: 'cafe',
    });
  });

  test('rejects an ambiguous bare leaf', () => {
    const registry = new CategoryRegistry(nodes);
    expect(registry.resolve('cafe')).toEqual({ error: 'ambiguous_leaf' });
  });

  test('resolves an unambiguous legacy leaf to its parent pair', () => {
    const registry = new CategoryRegistry([nodes[0]!, nodes[2]!]);
    expect(canonicalizeCategory(registry, 'cafe')).toEqual({
      category: 'dining',
      subcategory: 'cafe',
    });
  });

  test('rejects impossible parent/child pairs', () => {
    const registry = new CategoryRegistry(nodes);
    expect(registry.resolvePair('utilities', 'cafe')).toEqual({ error: 'invalid_pair' });
  });

  test('wildcard is accepted only in rule-oriented resolution', () => {
    const registry = new CategoryRegistry(nodes);
    expect(registry.resolve('*')).toEqual({ error: 'wildcard_not_allowed' });
    expect(registry.resolvePair('*')).toEqual({ value: { category: '*' } });
    expect(registry.resolvePair('*', 'cafe')).toEqual({ error: 'invalid_pair' });
  });
});
