# Cycle 39 High Priority Implementation Plan

**Source:** `.context/reviews/cycle39-aggregate.md`, individual cycle39 review files
**Date:** 2026-05-06
**Status:** Pending

---

## Task 1: Add NaN/Infinity validation to `calculateRewards`

**Finding:** BUG-39-01 / ARCH-39-02 / C39-V03
**File:** `packages/core/src/calculator/reward.ts:185-191`
**Severity:** Medium
**Confidence:** High

**Change:** Add input validation at the top of `calculateRewards` to guard against NaN, Infinity, and negative values in `previousMonthSpending`.

```typescript
export function calculateRewards(input: CalculationInput): CalculationOutput {
  const { transactions, previousMonthSpending, cardRule } = input;

  // Guard against NaN/Infinity/negative previousMonthSpending which would
  // silently produce zero rewards (no tier matches NaN comparisons).
  if (!Number.isFinite(previousMonthSpending) || previousMonthSpending < 0) {
    throw new Error(
      `previousMonthSpending must be a non-negative finite number, got ${previousMonthSpending}`
    );
  }
```

**Risk:** Low — adds validation to core function. Callers already guard in most cases (analyzer.ts). This catches edge cases that slip through.
**Tests:** Add test for NaN input, Infinity input, negative input.
**Gate:** Run after implementation.

---

## Task 2: Fix `parseAmountString` to reject trailing non-numeric characters

**Finding:** CR-39-01 / SEC-39-02 / C39-V02
**File:** `packages/parser/src/csv/shared.ts:175-178`
**Severity:** Medium
**Confidence:** High

**Change:** Replace the permissive afterNum check with one that rejects ANY trailing content.

```typescript
// Before:
const afterNum = cleaned.slice(numMatch[0].length);
if (/[\d.]/.test(afterNum)) return null;

// After:
const afterNum = cleaned.slice(numMatch[0].length);
if (afterNum.trim().length > 0) return null;
```

**Risk:** Low-Medium — may reject inputs that were previously accepted. Need to verify no legitimate Korean amount formats have trailing non-numeric characters.
**Tests:** Add tests for "1234abc", "50000원금", "10000!!!" — all should return null.
**Gate:** Run after implementation. Check existing tests pass.

---

## Task 3: Optimize JSON `findField` with lowercase lookup map

**Finding:** PERF-39-01 / C39-V01
**File:** `packages/parser/src/json/index.ts:67-82`
**File:** `apps/web/src/lib/parser/json.ts:67-82`
**Severity:** Low
**Confidence:** Medium

**Change:** Build a lowercase key-to-value Map once per object for O(keys) + O(aliases) case-insensitive lookup.

```typescript
function findField(obj: Record<string, unknown>, aliases: string[]): unknown {
  // Exact match first (fast path)
  for (const alias of aliases) {
    if (Object.hasOwn(obj, alias)) return obj[alias];
  }
  // Case-insensitive fallback — build lowercase lookup map once (C39-PERF01)
  const lowerMap = new Map<string, unknown>();
  for (const key of Object.keys(obj)) {
    lowerMap.set(key.toLowerCase(), obj[key]);
  }
  for (const alias of aliases) {
    const v = lowerMap.get(alias.toLowerCase());
    if (v !== undefined) return v;
  }
  return undefined;
}
```

**Risk:** Low — same behavior, better performance.
**Tests:** Existing JSON parser tests should pass. Add test for mixed-case field names.
**Gate:** Run after implementation.

---

## Task 4: Add parity tests for non-spending amount handling across all parsers

**Finding:** TE-39-02
**File:** New test file or existing test files
**Severity:** Medium
**Confidence:** High

**Change:** Create a parameterized test that verifies all parsers (CSV, XLSX, HTML, JSON, OFX) emit ParseErrors with consistent messages for:
- Zero amounts
- Negative amounts
- Refund/credit scenarios

**Risk:** None — test addition only.
**Gate:** Tests must pass.

---

## Deferred from Cycle 39

| ID | Severity | Reason | Exit Criterion |
|----|----------|--------|----------------|
| BUG-39-02 | Low | Web-side normalizeHTML while-loop is defensive, low impact | Parser unification cycle |
| BUG-39-03 | Low | RegExp creation overhead is minor (1000 objects per parse) | Performance optimization cycle |
| CR-39-02 | Low | Error message quality issue, not correctness | UX enhancement cycle |
| CR-39-03 | Low | Detection error propagation requires detectFormatFromFile API change | Parser API refactor cycle |
| ARCH-39-01 | Low | Parser dedup is large refactoring (~1500 lines) | Parser API refactor cycle |
| C39-CRIT01 | Medium | Cycle reference cleanup is cosmetic, no functional impact | Dedicated cleanup cycle |
| C39-CRIT02 | Medium | Removing parity comments without dedup is premature | Parser API refactor cycle |
| C39-CRIT03 | Low | Warnings array requires API change + UI updates | UX enhancement cycle |
| U-DES-39-01 | Medium | ParseError severity requires schema change + UI updates | UX enhancement cycle |
| U-DES-39-02 | Low | Filtered transaction count requires return shape change | UX enhancement cycle |
| DOC-39-01 | Low | JSDoc clarification is cosmetic | Documentation cycle |
| DOC-39-02 | Low | `@throws` addition is cosmetic | Documentation cycle |
| TE-39-01 | Medium | Web-side HTML tests require test infrastructure for SheetJS in browser | Test infrastructure cycle |
| TE-39-03 | Low | Case-insensitive matching tests are low priority | Standard test backlog |
| PERF-39-03 | Medium | cardPreviousSpending is documented trade-off | Benchmark + optimization cycle |
| CR-15 | Medium | ReDoS requires regex decomposition | Parser hardening cycle |
| SEC-01 | Medium | CSP nonce requires Astro build changes | Security hardening cycle |
| PERF-02 | Medium | Optimizer algorithmic improvement needs benchmarking | Benchmark cycle |

---

## Implementation Order

1. Task 2 (parseAmountString fix) — test impact first
2. Task 1 (calculateRewards NaN guard) — core validation
3. Task 3 (JSON findField optimization) — both server and web
4. Task 4 (parity tests) — test addition
5. Run gates after each task
6. Commit each task separately with semantic messages
