import { describe, test, expect } from 'bun:test';
import { buildCategoryNamesKo } from '../src/category-names.js';
import type { CategoryNode } from '../src/types.js';

describe('buildCategoryNamesKo', () => {
  test('returns empty object for empty input', () => {
    const result = buildCategoryNamesKo([]);
    expect(result).toEqual({});
  });

  test('includes parent category IDs and labels', () => {
    const nodes: CategoryNode[] = [
      { id: 'dining', labelKo: '외식', labelEn: 'Dining', keywords: [] },
      { id: 'travel', labelKo: '여행', labelEn: 'Travel', keywords: [] },
    ];
    const result = buildCategoryNamesKo(nodes);
    expect(result['dining']).toBe('외식');
    expect(result['travel']).toBe('여행');
  });

  test('includes dot-notation subcategory keys', () => {
    const nodes: CategoryNode[] = [
      {
        id: 'dining',
        labelKo: '외식',
        labelEn: 'Dining',
        keywords: [],
        subcategories: [
          { id: 'cafe', labelKo: '카페', labelEn: 'Cafe', keywords: [] },
          { id: 'restaurant', labelKo: '일반음식점', labelEn: 'Restaurant', keywords: [] },
        ],
      },
    ];
    const result = buildCategoryNamesKo(nodes);
    expect(result['dining.cafe']).toBe('카페');
    expect(result['dining.restaurant']).toBe('일반음식점');
  });

  test('does not include bare subcategory IDs', () => {
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
    ];
    const result = buildCategoryNamesKo(nodes);
    expect(result['cafe']).toBeUndefined();
  });

  test('handles nodes without subcategories', () => {
    const nodes: CategoryNode[] = [
      { id: 'telecom', labelKo: '통신', labelEn: 'Telecom', keywords: [] },
    ];
    const result = buildCategoryNamesKo(nodes);
    expect(result['telecom']).toBe('통신');
    expect(Object.keys(result).length).toBe(1);
  });

  test('handles multiple nodes with mixed subcategories', () => {
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
      { id: 'telecom', labelKo: '통신', labelEn: 'Telecom', keywords: [] },
    ];
    const result = buildCategoryNamesKo(nodes);
    expect(Object.keys(result).length).toBe(3);
    expect(result['dining']).toBe('외식');
    expect(result['dining.cafe']).toBe('카페');
    expect(result['telecom']).toBe('통신');
  });
});
