# Plan 21 — Medium-Priority Fixes (Cycle 11)

**Priority:** MEDIUM
**Findings addressed:** C11-07, C11-13, C11-14, C11-10
**Status:** PENDING

---

## Task 1: Add Content-Security-Policy headers (C11-07)

**Finding:** The web app has no Content-Security-Policy headers. Without CSP, XSS vulnerabilities in third-party dependencies are exploitable. The app loads data from its own origin and uses inline scripts (dashboard.js). CSP is a defense-in-depth improvement.

**Status:** ALREADY IMPLEMENTED — CSP is already present via a `<meta>` tag in `apps/web/src/layouts/Layout.astro:49`. The policy includes `default-src 'self'`, `script-src 'self' 'strict-dynamic' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `font-src 'self'`, `worker-src 'self' blob:`, and `connect-src 'self'`. A TODO comment exists for migrating to hash-based CSP.

**Commit:** (no commit needed — already implemented)

---

## Task 2: Add unit tests for merchant name length guard (C11-13)

**Finding:** `packages/core/__tests__/categorizer.test.ts` — The cycle 10 fix added a `lower.length < 2` guard in `MerchantMatcher.match()` and a `lower.length >= 3` check for reverse substring matching. These behavioral changes need dedicated test cases.

**File:** `packages/core/__tests__/categorizer.test.ts`

**Implementation:**
1. Add test cases in the categorizer test file:
```ts
describe('MerchantMatcher - length guard', () => {
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

  test('two character name works for forward matching', () => {
    // 2-char merchant should match if a keyword exactly matches
    // but should NOT reverse-match longer keywords
    const result = matcher.match('스타');
    // "스타" should not match "스타벅스" via reverse substring (needs >= 3 chars)
    // but may match if "스타" is an exact keyword
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  test('three character name can reverse-match longer keywords', () => {
    // 3-char merchant CAN reverse-match via kw.includes(lower)
    const result = matcher.match('스타벅'); // partial match of "스타벅스"
    // This should work for reverse matching
    expect(result.category).not.toBe('uncategorized');
  });
});
```

**Commit:** `test(core): ✅ add unit tests for merchant name length guard in MerchantMatcher`

---

## Task 3: Add integration test for reoptimize latest-month filtering (C11-14)

**Finding:** `apps/web/__tests__/` — The cycle 10 fix added `getLatestMonth` and filtering logic in `reoptimize`. There is no integration test verifying that multi-month reoptimize only optimizes the latest month.

**File:** `apps/web/__tests__/analyzer-adapter.test.ts` (new test cases)

**Implementation:**
1. Add test cases that verify the multi-month behavior:
```ts
describe('getLatestMonth', () => {
  test('returns null for empty array', () => {
    expect(getLatestMonth([])).toBe(null);
  });

  test('returns the latest month from multi-month transactions', () => {
    const txs = [
      { id: 't1', date: '2026-01-15', merchant: 'A', amount: 10000, category: 'dining', subcategory: undefined, confidence: 1.0 },
      { id: 't2', date: '2026-02-15', merchant: 'B', amount: 20000, category: 'grocery', subcategory: undefined, confidence: 1.0 },
      { id: 't3', date: '2026-03-15', merchant: 'C', amount: 30000, category: 'cafe', subcategory: undefined, confidence: 1.0 },
    ];
    expect(getLatestMonth(txs)).toBe('2026-03');
  });

  test('returns the only month for single-month transactions', () => {
    const txs = [
      { id: 't1', date: '2026-01-15', merchant: 'A', amount: 10000, category: 'dining', subcategory: undefined, confidence: 1.0 },
    ];
    expect(getLatestMonth(txs)).toBe('2026-01');
  });

  test('handles transactions with invalid dates', () => {
    const txs = [
      { id: 't1', date: '', merchant: 'A', amount: 10000, category: 'dining', subcategory: undefined, confidence: 1.0 },
      { id: 't2', date: '2026-02-15', merchant: 'B', amount: 20000, category: 'grocery', subcategory: undefined, confidence: 1.0 },
    ];
    expect(getLatestMonth(txs)).toBe('2026-02');
  });
});
```

**Commit:** `test(web): ✅ add integration tests for getLatestMonth and reoptimize filtering`

---

## Task 4: Change default rewardType for no-rule categories from 'discount' to 'none' (C11-10)

**Finding:** `packages/core/src/calculator/reward.ts:200-203` — When a bucket is created with no matching rule, `rewardType` defaults to `rule?.type ?? 'discount'`, which is `'discount'`. This is misleading for categories that have no matching reward rule. The UI might display "할인" (discount) for categories where no discount applies.

**File:** `packages/core/src/calculator/reward.ts`

**Implementation:**
1. Change the default `rewardType` from `'discount'` to `'none'` when no rule matches:
```ts
const bucket =
  categoryRewards.get(categoryKey) ??
  {
    category: categoryKey,
    categoryNameKo: categoryKey,
    spending: 0,
    reward: 0,
    rate: 0,
    rewardType: 'none', // No rule matched — not a discount
    capReached: false,
  };
```

2. Update the UI components that display `rewardType` to handle the `'none'` case:
   - Check `SavingsComparison.svelte` and `CategoryBreakdown.svelte` for any `rewardType` references
   - Add a fallback: if `rewardType === 'none'`, display "해당 없음" or hide the reward type label

**Note:** This is a behavioral change that affects the output API. Downstream consumers (UI, reports) must be updated. If the change is too risky, document the behavior instead.

**Commit:** `fix(core): 🛡️ change default rewardType from 'discount' to 'none' for no-rule categories`

---

## Progress

- [x] Task 1: Add Content-Security-Policy headers — ALREADY IMPLEMENTED (CSP via meta tag in Layout.astro)
- [x] Task 2: Add unit tests for merchant name length guard — Committed (00000000b372c956)
- [x] Task 3: Add integration tests for getLatestMonth — Implemented
- [x] Task 4: Change default rewardType for no-rule categories — Implemented
