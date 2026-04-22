/**
 * Unit tests for the toCoreCardRuleSets type adapter logic.
 *
 * The actual adapter is a private function in analyzer.ts, so we test
 * the narrowing logic by reproducing the same validation sets and rules.
 */
import { describe, test, expect } from 'bun:test';

// Reproduce CategorizedTx type locally to avoid importing from analyzer.js,
// which transitively imports pdfjs-dist (incompatible with bun:test due to
// the Vite ?url import syntax).
interface CategorizedTx {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  subcategory: string | undefined;
  confidence: number;
}

// Reproduce getLatestMonth locally — same logic as analyzer.ts
function getLatestMonth(transactions: CategorizedTx[]): string | null {
  if (transactions.length === 0) return null;
  const months = new Set<string>();
  for (const tx of transactions) {
    if (tx.date && tx.date.length >= 7) {
      months.add(tx.date.slice(0, 7));
    }
  }
  const sorted = [...months].sort();
  return sorted[sorted.length - 1] ?? null;
}

// Mirrors the VALID_SOURCES set from analyzer.ts
const VALID_SOURCES = new Set(['manual', 'llm-scrape', 'web']);
// Mirrors the VALID_REWARD_TYPES set from analyzer.ts
const VALID_REWARD_TYPES = new Set(['discount', 'points', 'cashback', 'mileage']);

// Minimal fixture matching the web CardRuleSet shape
interface WebCardRuleSet {
  card: { id: string; source: string; [k: string]: unknown };
  rewards: Array<{
    type: string;
    tiers: Array<{ unit?: string | null; [k: string]: unknown }>;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
}

// The adapter logic — mirrors toCoreCardRuleSets from analyzer.ts
function toCoreCardRuleSets(rules: WebCardRuleSet[]) {
  return rules.map((rule) => ({
    ...rule,
    card: {
      ...rule.card,
      source: VALID_SOURCES.has(rule.card.source)
        ? (rule.card.source as 'manual' | 'llm-scrape' | 'web')
        : 'web',
    },
    rewards: rule.rewards.map((r) => ({
      ...r,
      type: VALID_REWARD_TYPES.has(r.type)
        ? (r.type as 'discount' | 'points' | 'cashback' | 'mileage')
        : 'discount',
      tiers: r.tiers.map((t) => ({
        ...t,
        unit: t.unit ?? null,
      })),
    })),
  }));
}

describe('toCoreCardRuleSets type adapter', () => {
  const baseRule: WebCardRuleSet = {
    card: { id: 'test-card', source: 'manual', nameKo: '테스트' },
    rewards: [{
      type: 'discount',
      tiers: [{ performanceTier: 'tier0', rate: 1, monthlyCap: null, perTransactionCap: null }],
    }],
  };

  test('valid source values pass through unchanged', () => {
    for (const src of ['manual', 'llm-scrape', 'web'] as const) {
      const result = toCoreCardRuleSets([{ ...baseRule, card: { ...baseRule.card, source: src } }]);
      expect(result[0]!.card.source).toBe(src);
    }
  });

  test('unknown source value falls back to "web"', () => {
    const result = toCoreCardRuleSets([{ ...baseRule, card: { ...baseRule.card, source: 'unknown-source' } }]);
    expect(result[0]!.card.source).toBe('web');
  });

  test('empty string source falls back to "web"', () => {
    const result = toCoreCardRuleSets([{ ...baseRule, card: { ...baseRule.card, source: '' } }]);
    expect(result[0]!.card.source).toBe('web');
  });

  test('valid reward types pass through unchanged', () => {
    for (const type of ['discount', 'points', 'cashback', 'mileage'] as const) {
      const result = toCoreCardRuleSets([{
        ...baseRule,
        rewards: [{ type, tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null }] }],
      }]);
      expect(result[0]!.rewards[0]!.type).toBe(type);
    }
  });

  test('unknown reward type falls back to "discount"', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'unknown-type', tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null }] }],
    }]);
    expect(result[0]!.rewards[0]!.type).toBe('discount');
  });

  test('null unit is normalized to null', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'discount', tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null, unit: null }] }],
    }]);
    expect(result[0]!.rewards[0]!.tiers[0]!.unit).toBeNull();
  });

  test('undefined unit is normalized to null', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'discount', tiers: [{ rate: 1, monthlyCap: null, perTransactionCap: null, unit: undefined }] }],
    }]);
    expect(result[0]!.rewards[0]!.tiers[0]!.unit).toBeNull();
  });

  test('string unit is preserved', () => {
    const result = toCoreCardRuleSets([{
      ...baseRule,
      rewards: [{ type: 'discount', tiers: [{ rate: null, monthlyCap: null, perTransactionCap: null, unit: 'won_per_day', fixedAmount: 3000 }] }],
    }]);
    expect(result[0]!.rewards[0]!.tiers[0]!.unit).toBe('won_per_day');
  });

  test('all other fields are preserved unchanged', () => {
    const rule: WebCardRuleSet = {
      card: { id: 'preserve-test', source: 'manual', extra: 'field' },
      rewards: [{
        type: 'points',
        category: 'dining',
        tiers: [{ performanceTier: 'tier1', rate: 3, monthlyCap: 5000, perTransactionCap: null, unit: null }],
      }],
      extraField: true,
    };
    const result = toCoreCardRuleSets([rule]);
    expect(result[0]!.card.id).toBe('preserve-test');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0]!.card as any).extra).toBe('field');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0]!.rewards[0] as any).category).toBe('dining');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0] as any).extraField).toBe(true);
  });
});

describe('getLatestMonth', () => {
  function makeTx(id: string, date: string): CategorizedTx {
    return {
      id,
      date,
      merchant: 'test',
      amount: 10000,
      category: 'dining',
      subcategory: undefined,
      confidence: 1.0,
    };
  }

  test('returns null for empty array', () => {
    expect(getLatestMonth([])).toBe(null);
  });

  test('returns the latest month from multi-month transactions', () => {
    const txs = [
      makeTx('t1', '2026-01-15'),
      makeTx('t2', '2026-02-15'),
      makeTx('t3', '2026-03-15'),
    ];
    expect(getLatestMonth(txs)).toBe('2026-03');
  });

  test('returns the only month for single-month transactions', () => {
    const txs = [makeTx('t1', '2026-01-15')];
    expect(getLatestMonth(txs)).toBe('2026-01');
  });

  test('handles transactions with invalid dates', () => {
    const txs = [
      { ...makeTx('t1', ''), date: '' },
      makeTx('t2', '2026-02-15'),
    ];
    expect(getLatestMonth(txs)).toBe('2026-02');
  });

  test('handles transactions with short dates gracefully', () => {
    const txs = [
      { ...makeTx('t1', '2026'), date: '2026' },
      makeTx('t2', '2026-03-15'),
    ];
    expect(getLatestMonth(txs)).toBe('2026-03');
  });
});

describe('multi-month transaction handling', () => {
  function makeTx(id: string, date: string, amount: number, category: string, subcategory?: string): CategorizedTx {
    return {
      id,
      date,
      merchant: `merchant-${id}`,
      amount,
      category,
      subcategory: subcategory ?? undefined,
      confidence: 1.0,
    };
  }

  test('monthlyBreakdown is computed correctly for multi-month data', () => {
    // Simulate the monthlyBreakdown calculation from analyzer.ts
    const txs = [
      makeTx('t1', '2026-01-15', 50000, 'dining'),
      makeTx('t2', '2026-01-20', 30000, 'grocery'),
      makeTx('t3', '2026-02-10', 40000, 'dining'),
      makeTx('t4', '2026-02-15', 20000, 'transportation'),
    ];

    const monthlySpending = new Map<string, number>();
    const monthlyTxCount = new Map<string, number>();
    for (const tx of txs) {
      // Guard against malformed dates shorter than 7 chars (YYYY-MM) —
      // matches the guard in analyzer.ts analyzeMultipleFiles().
      if (!tx.date || tx.date.length < 7) continue;
      const month = tx.date.slice(0, 7);
      // Only accumulate positive amounts for monthlySpending to match Korean
      // 전월실적 (gross spending) convention (C1-01/C6-01). Using Math.abs()
      // would incorrectly include refunds as positive spending.
      if (tx.amount > 0) {
        monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
      }
      monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
    }

    const breakdown = [...monthlySpending.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spending]) => ({
        month,
        spending,
        transactionCount: monthlyTxCount.get(month) ?? 0,
      }));

    expect(breakdown.length).toBe(2);
    expect(breakdown[0]).toEqual({ month: '2026-01', spending: 80000, transactionCount: 2 });
    expect(breakdown[1]).toEqual({ month: '2026-02', spending: 60000, transactionCount: 2 });
  });

  test('getLatestMonth correctly identifies the latest month for optimization', () => {
    const txs = [
      makeTx('t1', '2026-01-15', 50000, 'dining'),
      makeTx('t2', '2026-02-10', 40000, 'grocery'),
      makeTx('t3', '2026-03-05', 30000, 'transportation'),
    ];
    expect(getLatestMonth(txs)).toBe('2026-03');
  });

  test('previous month spending is computed from non-latest months', () => {
    const txs = [
      makeTx('t1', '2026-01-15', 50000, 'dining'),
      makeTx('t2', '2026-01-20', 30000, 'grocery'),
      makeTx('t3', '2026-02-10', 40000, 'dining'),
    ];

    // Previous month = 2026-01, spending = 80000
    // Guard against malformed dates shorter than 7 chars (YYYY-MM) —
    // matches the guard in analyzer.ts analyzeMultipleFiles().
    const months = new Set(txs.filter(tx => tx.date && tx.date.length >= 7).map(tx => tx.date.slice(0, 7)));
    const sorted = [...months].sort();
    const latestMonth = sorted[sorted.length - 1]!;
    const previousMonth = sorted.length >= 2 ? sorted[sorted.length - 2]! : null;

    expect(latestMonth).toBe('2026-02');
    expect(previousMonth).toBe('2026-01');

    // Only accumulate positive amounts for monthlySpending to match Korean
    // 전월실적 (gross spending) convention (C1-01/C6-01). Using Math.abs()
    // would incorrectly include refunds as positive spending.
    const prevMonthSpending = txs
      .filter(tx => tx.date.startsWith(previousMonth!) && tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    expect(prevMonthSpending).toBe(80000);
  });

  test('monthlyBreakdown excludes negative-amount transactions (refunds) from spending (C6-01)', () => {
    // Refunds should NOT contribute to monthlySpending — Korean 전월실적
    // counts gross spending only. A Math.abs() bug would include the
    // -15000 refund as +15000, inflating January to 95000 instead of 80000.
    const txs = [
      makeTx('t1', '2026-01-15', 50000, 'dining'),
      makeTx('t2', '2026-01-20', 30000, 'grocery'),
      makeTx('t3', '2026-01-22', -15000, 'dining'),  // refund
      makeTx('t4', '2026-02-10', 40000, 'dining'),
    ];

    const monthlySpending = new Map<string, number>();
    const monthlyTxCount = new Map<string, number>();
    for (const tx of txs) {
      if (!tx.date || tx.date.length < 7) continue;
      const month = tx.date.slice(0, 7);
      if (tx.amount > 0) {
        monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
      }
      monthlyTxCount.set(month, (monthlyTxCount.get(month) ?? 0) + 1);
    }

    const breakdown = [...monthlySpending.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, spending]) => ({
        month,
        spending,
        transactionCount: monthlyTxCount.get(month) ?? 0,
      }));

    expect(breakdown.length).toBe(2);
    // January: 50000 + 30000 = 80000 (refund -15000 excluded from spending)
    expect(breakdown[0]).toEqual({ month: '2026-01', spending: 80000, transactionCount: 3 });
    expect(breakdown[1]).toEqual({ month: '2026-02', spending: 40000, transactionCount: 1 });
  });

  test('filtering to latest month preserves only latest transactions', () => {
    const txs = [
      makeTx('t1', '2026-01-15', 50000, 'dining'),
      makeTx('t2', '2026-02-10', 40000, 'grocery'),
      makeTx('t3', '2026-02-15', 30000, 'transportation'),
    ];

    const latestMonth = getLatestMonth(txs);
    const latestTxs = txs.filter(tx => tx.date.startsWith(latestMonth!));

    expect(latestTxs.length).toBe(2);
    expect(latestTxs.every(tx => tx.date.startsWith('2026-02'))).toBe(true);
  });
});

describe('subcategory handling', () => {
  function makeTx(id: string, date: string, category: string, subcategory?: string): CategorizedTx {
    return {
      id,
      date,
      merchant: `merchant-${id}`,
      amount: 10000,
      category,
      subcategory: subcategory ?? undefined,
      confidence: 1.0,
    };
  }

  test('subcategory correctly pairs with parent category', () => {
    // When a user selects "cafe" (subcategory of "dining"),
    // category should be "dining" and subcategory should be "cafe"
    const subcategoryToParent = new Map<string, string>();
    subcategoryToParent.set('cafe', 'dining');
    subcategoryToParent.set('fast_food', 'dining');
    subcategoryToParent.set('supermarket', 'grocery');

    const selectedCategory = 'cafe';
    const parentCategory = subcategoryToParent.get(selectedCategory);

    expect(parentCategory).toBe('dining');

    // Simulating the changeCategory logic from TransactionReview
    const tx = makeTx('t1', '2026-03-15', 'uncategorized');
    if (parentCategory) {
      tx.category = parentCategory;
      tx.subcategory = selectedCategory;
    } else {
      tx.category = selectedCategory;
      tx.subcategory = undefined;
    }

    expect(tx.category).toBe('dining');
    expect(tx.subcategory).toBe('cafe');
  });

  test('top-level category selection clears subcategory', () => {
    const subcategoryToParent = new Map<string, string>();
    subcategoryToParent.set('cafe', 'dining');

    const selectedCategory = 'dining'; // top-level, not in subcategoryToParent
    const parentCategory = subcategoryToParent.get(selectedCategory);

    expect(parentCategory).toBeUndefined();

    const tx = makeTx('t1', '2026-03-15', 'grocery', 'supermarket');
    if (parentCategory) {
      tx.category = parentCategory;
      tx.subcategory = selectedCategory;
    } else {
      tx.category = selectedCategory;
      tx.subcategory = undefined;
    }

    expect(tx.category).toBe('dining');
    expect(tx.subcategory).toBeUndefined();
  });

  test('subcategory transactions build correct categoryKey for optimizer', () => {
    // The optimizer uses buildCategoryKey(category, subcategory) to group
    // transactions. Verify that "dining" + "cafe" produces "dining.cafe".
    function buildCategoryKey(category: string, subcategory?: string): string {
      return subcategory ? `${category}.${subcategory}` : category;
    }

    expect(buildCategoryKey('dining', 'cafe')).toBe('dining.cafe');
    expect(buildCategoryKey('dining')).toBe('dining');
    expect(buildCategoryKey('grocery', 'supermarket')).toBe('grocery.supermarket');
  });
});
