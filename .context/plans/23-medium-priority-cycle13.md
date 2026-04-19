# Plan 23 — Medium-Priority Fixes (Cycle 13)

**Priority:** MEDIUM
**Findings addressed:** C13-12, C13-13
**Status:** PENDING

---

## Task 1: Add unit tests for parseDateToISO (C13-12)

**Finding:** No unit tests exist for the `parseDateToISO` helper functions in CSV, XLSX, and PDF parsers. These functions handle many date formats and have subtle bugs (C13-01/C13-02). Dedicated tests would catch regressions.

**File:** `apps/web/__tests__/parser-date.test.ts` (new file)

**Implementation:**
1. Create a test file that tests the date parsing logic for all supported formats. Since `parseDateToISO` is a private function in each parser module, reproduce the core logic locally (same pattern as `analyzer-adapter.test.ts`):

```ts
import { describe, test, expect } from 'bun:test';

// Reproduce parseDateToISO logic from csv.ts for testing
// (The actual function is private, so we test the same logic)
function inferYear(month: number, day: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate.getTime() - now.getTime() > 90 * 24 * 60 * 60 * 1000) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}

function parseDateToISO_CSV(raw: string): string {
  const cleaned = raw.trim();
  const fullMatch = cleaned.match(/^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})/);
  if (fullMatch) return `${fullMatch[1]}-${fullMatch[2]!.padStart(2, '0')}-${fullMatch[3]!.padStart(2, '0')}`;
  if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  const shortYearMatch = cleaned.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})$/);
  if (shortYearMatch) {
    const year = parseInt(shortYearMatch[1]!, 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    return `${fullYear}-${shortYearMatch[2]!.padStart(2, '0')}-${shortYearMatch[3]!.padStart(2, '0')}`;
  }
  // ... more patterns
  return cleaned;
}

describe('parseDateToISO - CSV', () => {
  test('YYYY-MM-DD format', () => {
    expect(parseDateToISO_CSV('2024-01-15')).toBe('2024-01-15');
  });
  test('YYYY.MM.DD format', () => {
    expect(parseDateToISO_CSV('2024.01.15')).toBe('2024-01-15');
  });
  test('YYYY/MM/DD format', () => {
    expect(parseDateToISO_CSV('2024/01/15')).toBe('2024-01-15');
  });
  test('YYYYMMDD format', () => {
    expect(parseDateToISO_CSV('20240115')).toBe('2024-01-15');
  });
  test('YY-MM-DD format with zero-padding', () => {
    // This is the C13-01 regression test
    expect(parseDateToISO_CSV('24-01-05')).toBe('2024-01-05');
    expect(parseDateToISO_CSV('24.1.5')).toBe('2024-01-05');
  });
  test('YY >= 50 maps to 1900s', () => {
    expect(parseDateToISO_CSV('99-12-31')).toBe('1999-12-31');
  });
  test('YY < 50 maps to 2000s', () => {
    expect(parseDateToISO_CSV('25-06-15')).toBe('2025-06-15');
  });
  test('Korean full date', () => {
    expect(parseDateToISO_CSV('2024년 1월 15일')).toBe('2024-01-15');
  });
  test('Korean short date with inferred year', () => {
    const result = parseDateToISO_CSV('1월 15일');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });
  test('MM/DD format with inferred year', () => {
    const result = parseDateToISO_CSV('01/15');
    expect(result).toMatch(/^\d{4}-01-15$/);
  });
});
```

2. Also add tests for the `inferYear` function to verify the look-back heuristic.

**Commit:** `test(parser): ✅ add unit tests for parseDateToISO date parsing across all formats`

---

## Task 2: Add test for calculateRewards global cap rollback (C13-13)

**Finding:** `packages/core/src/calculator/reward.ts:265-270` — The global cap rollback logic is subtle and untested. When the global cap clips a reward, the rule-level tracker is rolled back. Without tests, a regression could cause over/under-counting of rewards.

**File:** `packages/core/__tests__/reward-cap-rollback.test.ts` (new file)

**Implementation:**
1. Create a test that exercises the global cap + rule-level cap interaction:

```ts
import { describe, test, expect } from 'bun:test';
import { calculateRewards } from '../src/calculator/reward.js';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { CategorizedTransaction } from '../src/models/transaction.js';

// Build a minimal card rule with both rule-level and global caps
function makeCardRule(ruleCap: number | null, globalCap: number | null): CardRuleSet {
  return {
    card: { id: 'test-card', issuer: 'test', name: 'Test', nameKo: '테스트', type: 'credit', annualFee: { domestic: 0, international: 0 }, url: '', lastUpdated: '', source: 'manual' },
    performanceTiers: [{ id: 'tier1', label: '기본', minSpending: 0, maxSpending: null }],
    performanceExclusions: [],
    rewards: [{
      category: 'dining',
      type: 'discount',
      tiers: [{
        performanceTier: 'tier1',
        rate: 10, // 10%
        monthlyCap: ruleCap,
        perTransactionCap: null,
      }],
    }],
    globalConstraints: {
      monthlyTotalDiscountCap: globalCap,
      minimumAnnualSpending: null,
    },
  };
}

function makeTx(id: string, amount: number): CategorizedTransaction {
  return {
    id, date: '2026-03-15', merchant: 'test', amount, currency: 'KRW',
    category: 'dining', subcategory: undefined, confidence: 1.0,
  };
}

describe('calculateRewards — global cap rollback', () => {
  test('global cap clips reward and rule tracker is rolled back', () => {
    // 3 transactions of 1000 Won each at 10% = 100 Won reward each
    // Rule-level cap: unlimited
    // Global cap: 150 Won total
    // Expected: first two get 100 each (total 200, but clipped to 150)
    // The third gets 0 (global cap exhausted)
    const rule = makeCardRule(null, 150);
    const txs = [makeTx('t1', 1000), makeTx('t2', 1000), makeTx('t3', 1000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    // Total reward should be exactly 150 (global cap)
    expect(result.totalReward).toBe(150);
    // The dining category should have reward <= 150
    const diningReward = result.rewards.find(r => r.category === 'dining');
    expect(diningReward?.reward).toBe(150);
  });

  test('rule-level cap and global cap both apply', () => {
    // 3 transactions of 1000 Won each at 10% = 100 Won reward each
    // Rule-level cap: 120 Won
    // Global cap: 200 Won (looser than rule cap)
    // Expected: first two transactions produce 100+20=120 (rule cap hit)
    // Third produces 0 (rule cap already hit, no more room)
    const rule = makeCardRule(120, 200);
    const txs = [makeTx('t1', 1000), makeTx('t2', 1000), makeTx('t3', 1000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    expect(result.totalReward).toBe(120);
  });

  test('global cap tighter than rule cap rolls back rule tracker correctly', () => {
    // 2 transactions of 1000 Won at 10% = 100 Won each
    // Rule-level cap: 200 (loose)
    // Global cap: 50 (very tight)
    // Expected: first transaction would produce 100, but global cap clips to 50
    // Rule tracker is rolled back: ruleMonthUsed should be 50 (not 100)
    // Second transaction: global cap exhausted, reward = 0
    const rule = makeCardRule(200, 50);
    const txs = [makeTx('t1', 1000), makeTx('t2', 1000)];
    const result = calculateRewards({ transactions: txs, previousMonthSpending: 0, cardRule: rule });

    expect(result.totalReward).toBe(50);
    const diningReward = result.rewards.find(r => r.category === 'dining');
    expect(diningReward?.reward).toBe(50);
    // Should have a capsHit entry for the global cap
    expect(result.capsHit.length).toBeGreaterThan(0);
  });
});
```

**Commit:** `test(core): ✅ add tests for calculateRewards global cap rollback behavior`

---

## Progress

- [ ] Task 1: Add unit tests for parseDateToISO
- [ ] Task 2: Add test for calculateRewards global cap rollback
