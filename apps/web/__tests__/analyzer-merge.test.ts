import { describe, expect, test } from 'bun:test';
import { appendCategorizedTransactions } from '../src/lib/analyzer.js';
import type { CategorizedTx } from '../src/lib/analysis-result.js';

describe('large analyzer transaction merge', () => {
  test('retains order above JavaScript spread-argument limits', () => {
    const count = 130_001;
    const source: CategorizedTx[] = Array.from({ length: count }, (_, index) => ({
      id: `tx-${index}`,
      date: '2026-07-23',
      merchant: `merchant-${index}`,
      amount: index + 1,
      category: 'uncategorized',
      subcategory: undefined,
      confidence: 0,
    }));
    const target: CategorizedTx[] = [];

    appendCategorizedTransactions(target, source);

    expect(target).toHaveLength(count);
    expect(target[0]?.id).toBe('tx-0');
    expect(target[65_000]?.id).toBe('tx-65000');
    expect(target.at(-1)?.id).toBe(`tx-${count - 1}`);
  });
});
