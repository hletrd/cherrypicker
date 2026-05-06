# Debugger Review — CherryPicker Cycle 39

**Reviewer:** debugger (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### BUG-39-01 — Medium — `previousMonthSpending` NaN silently disables all rewards

**File:** `packages/core/src/calculator/reward.ts:186-191`

The `calculateRewards` function accepts `previousMonthSpending` from input without validation:

```typescript
export function calculateRewards(input: CalculationInput): CalculationOutput {
  const { transactions, previousMonthSpending, cardRule } = input;
  // ...
  const tier = selectTier(performanceTiers, previousMonthSpending);
```

In `selectTier` (lines 10-28):
```typescript
const qualifying = sortedTiers.filter(
  (t) =>
    previousMonthSpending >= t.minSpending &&
    (t.maxSpending === null || previousMonthSpending <= t.maxSpending),
);
```

**Problem:** If `previousMonthSpending` is `NaN`, ALL comparisons return `false`. `qualifying` is empty, `selectTier` returns `undefined`, `tierId` becomes `'none'`, and `findRule` at line 230 returns `undefined` for all transactions. The user gets zero rewards with NO indication that something went wrong. The web-side `analyzer.ts` validates at line 230 that `options.previousMonthSpending >= 0`, but `NaN >= 0` is `false`, so it falls through to auto-calculation. However, the core calculator itself has no NaN guard.

**Failure scenario:** A corrupted sessionStorage value or malformed user input propagates NaN into the calculator. All rewards silently become 0. User thinks their cards have no benefits.

**Fix:** Add NaN/Infinity validation at the top of `calculateRewards`:
```typescript
if (!Number.isFinite(previousMonthSpending) || previousMonthSpending < 0) {
  throw new Error(`previousMonthSpending must be a non-negative finite number, got ${previousMonthSpending}`);
}
```

**Confidence:** High

---

### BUG-39-02 — Low — Web-side HTML `normalizeHTML` while-loop differs from server-side

**File:** `apps/web/src/lib/parser/html.ts:33-35`

```typescript
let cleaned = html;
while (/<script[\s\S]*?<\/script>/i.test(cleaned)) {
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
}
```

**Problem:** The server-side `normalizeHTML` in `packages/parser/src/csv/shared.ts:200-218` does NOT use a while-loop. It applies a single `.replace()` for each pattern. The while-loop on the web side was added to handle "nested/malformed tags" (C33-F11), but:
1. The `.test()` call before `.replace()` means the regex is executed twice per iteration
2. On pathological input with many script-like sequences, this could be slow
3. The server and web implementations now diverge in behavior — a file that parses on the server might behave differently in the browser

**Fix:** Align both implementations. The single-pass approach on the server side is sufficient for the threat model (XSS prevention during SheetJS parsing, not browser rendering).

**Confidence:** Medium

---

### BUG-39-03 — Low — OFX `extractTag` double-regex on every call

**File:** `packages/parser/src/ofx/index.ts:67-78`
**File:** `apps/web/src/lib/parser/ofx.ts:38-47`

```typescript
function extractTag(block: string, tagName: string): string {
  const safeTag = escapeRegExp(tagName);
  const xmlRe = new RegExp(`<${safeTag}[^>]*>\\s*([^<]+?)\\s*</${safeTag}>`, 'i');
  // ...
  const sgmlRe = new RegExp(`<${safeTag}[^>]*>\\s*([^<\\n\\r]+)`, 'i');
```

**Problem:** Two `RegExp` objects are created on EVERY call to `extractTag`. For a typical OFX file with 100 transactions and 5 tags each (DTPOSTED, TRNAMT, NAME, MEMO, TRNTYPE), that's 1000 RegExp constructions. This is unnecessary overhead.

**Fix:** Cache compiled regexes in a Map keyed by tag name, or compile once at module scope for the commonly-used tags.

**Confidence:** Low

---

## Carryover Verification

| ID | Status | Evidence |
|----|--------|----------|
| BUG-3 | PARTIALLY FIXED | Web-side NaN guard exists (analyzer.ts:230), core calculator still unprotected |
| BUG-4 | FIXED | CP949 small-buffer guard added (detect.ts:48-55) |
| BUG-7 | FIXED | OFX ParseError for positive amounts (ofx/index.ts:191-197) |
| C37-V04 | FIXED | isOnline removed from schema and code |
| C37-V07 | FIXED | NaN guard in analyzer.ts |
