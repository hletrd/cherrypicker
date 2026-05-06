# Cycle 26 — Code Reviewer Findings

**Date:** 2026-05-06
**Scope:** Full repository, emphasis on parsers, optimizer, and calculator
**Method:** Systematic file-by-file review with cross-reference to prior cycles

---

## C26-COR01 — Redundant identical branches in reward calculator (MEDIUM)

**File:** `packages/core/src/calculator/reward.ts:260-272`
**Confidence:** High

The `if/else if` chain at lines 260-272 has two branches with identical bodies:

```typescript
if (normalizedRate !== null && normalizedRate > 0 && hasFixedReward) {
  // Both rate and fixedAmount are present on the same tier. Korean card
  // rules do not currently use both together. The if/else structure can
  // only apply one, so rate-based reward takes precedence.
  const calcFn = getCalcFn(rule.type);
  const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
  rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
  ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
} else if (normalizedRate !== null && normalizedRate > 0) {
  const calcFn = getCalcFn(rule.type);
  const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
  rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
  ruleResult = applyMonthlyCap(rawReward, monthlyCap, currentRuleMonthUsed);
}
```

Both branches execute the exact same code. The comment says "rate-based reward takes precedence" but the code doesn't actually do anything different. If a card rule ever has both `rate` and `fixedAmount` on the same tier, the fixed reward is silently ignored rather than being combined or chosen.

**Impact:** If Korean card rules ever introduce combined rate+fixed rewards (e.g., "1% + 500 won per transaction"), the calculator will silently under-count by ignoring the fixed portion.

**Fix:** Either (a) remove the redundant branch and update the comment, or (b) implement actual combined reward calculation if that's the intended behavior.

---

## C26-COR02 — JSON parser preserves negative amounts, inconsistent with other parsers (MEDIUM)

**File:** `packages/parser/src/json/index.ts:115`
**Confidence:** High

The JSON parser at line 115 skips zero amounts (`if (amount === 0) return null;`) but preserves negative amounts. The CSV parser (`packages/parser/src/csv/shared.ts:122`), HTML parser (`packages/parser/src/html/index.ts:238`), XLSX parser, and OFX parser all skip `amount <= 0` at parse time.

```typescript
// JSON parser (line 115): only zero is skipped
if (amount === 0) return null;

// CSV parser (line 122): zero AND negative are skipped
if (amount <= 0) return false;

// HTML parser (line 238): zero AND negative are skipped
if (amount <= 0) continue;
```

The JSON parser comment says "Negative amounts (refunds/credits) are preserved — the optimizer's positive-only filter handles them." But this creates an inconsistency: users uploading JSON see refunds in their transaction list while CSV/HTML uploaders don't. The `greedyOptimize` filter at `packages/core/src/optimizer/greedy.ts:199` silently drops them during optimization.

**Impact:** Inconsistent UX across file formats. Users may be confused why refunds appear for JSON uploads but not CSV uploads.

**Fix:** Change line 115 to `if (amount <= 0) return null;` for parity with other parsers, or add a comment explaining the intentional difference and ensure the web UI handles negative amounts consistently.

---

## C26-COR03 — Unsafe non-null assertion in monthly spending lookup (LOW)

**File:** `apps/web/src/lib/analyzer.ts:367-368`
**Confidence:** Medium

```typescript
const previousMonthSpending = previousMonth
  ? monthlySpending.get(previousMonth)!
  : options?.previousMonthSpending;
```

The `!` after `monthlySpending.get(previousMonth)` is an unsafe non-null assertion. While `previousMonth` is derived from `months` which is derived from `monthlySpending.keys()`, a data integrity issue or future refactoring could break this invariant. TypeScript has no way to verify the map contains the key.

**Impact:** Potential runtime crash if the invariant is violated.

**Fix:** Replace with `monthlySpending.get(previousMonth) ?? 0` or add an explicit `has()` check.

---

## C26-COR04 — Fragile regex capture group assumption in web PDF fallback (LOW)

**File:** `apps/web/src/lib/parser/pdf.ts:626`
**Confidence:** Medium

```typescript
const date = parseDateToISO(dateMatch[1]!, errors);
```

The `fallbackDatePattern` at line 554 wraps the entire pattern in a single capture group: `/(...)/`. This makes `dateMatch[1]` equal to `dateMatch[0]`. If a future refactor removes the capture group or restructures the alternation, `dateMatch[1]` becomes `undefined` and the `!` assertion masks the error.

**Impact:** Silent breakage on regex refactor.

**Fix:** Use `dateMatch[0]` (the full match, which is always present) instead of `dateMatch[1]`. This is more robust because `RegExpMatchArray[0]` is guaranteed by the JS spec.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| MEDIUM | 2 | correctness, consistency |
| LOW | 2 | correctness, robustness |

**Verdict:** FIX AND SHIP — The reward calculator redundancy and JSON parser inconsistency are real issues that should be fixed.
