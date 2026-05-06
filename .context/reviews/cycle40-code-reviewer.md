# Code Review — CherryPicker Cycle 40

**Reviewer:** code-reviewer
**Scope:** Code quality, logic correctness, maintainability
**Date:** 2026-05-06

---

## Summary

Cycle 40 is a light review cycle. Three new issues identified, all Medium or Low severity. Two are data-validation gaps in the store layer, one is a parsing edge case. No critical or high-severity findings.

| Category | Count | Severity |
|---|---|---|
| New Findings | 3 | 1 Medium, 2 Low |
| Carryover | 2 | — |

---

## NEW FINDINGS

### CR-40-01: `analyze()` Stores Unvalidated `previousMonthSpending` in `previousMonthSpendingOption`
**File:** `apps/web/src/lib/store.svelte.ts:490-492`
**Severity:** Medium | **Confidence:** High

```typescript
if (options?.previousMonthSpending !== undefined) {
  analysisResult.previousMonthSpendingOption = options.previousMonthSpending;
}
```

`options.previousMonthSpending` is stored without `Number.isFinite()` or non-negative validation. If the UI (or a test) passes `NaN`, it flows into `analysisResult.previousMonthSpendingOption`, gets persisted to sessionStorage, and on next load `reoptimize` passes it to `optimizeFromTransactions`, which now throws (due to C39 fix). The user sees a generic "재계산 중 문제가 생겼어요" error with no actionable context.

**Fix:** Add the same `Number.isFinite() && >= 0` guard before storing:
```typescript
if (options?.previousMonthSpending !== undefined && Number.isFinite(options.previousMonthSpending) && options.previousMonthSpending >= 0) {
  analysisResult.previousMonthSpendingOption = options.previousMonthSpending;
}
```

---

### CR-40-02: `parseAmountString` Double-Negative Bug
**File:** `packages/parser/src/csv/shared.ts:165-183`
**Severity:** Low | **Confidence:** High

Input `(-1234)` is processed as follows:
1. `isNeg = true` (parentheses detected)
2. Parentheses stripped → `cleaned = "-1234"`
3. `numMatch = "-1234"`, `n = -1234`
4. `return isNeg ? -n : n` → `-(-1234) = 1234` (positive)

The parentheses notation is meant to indicate accounting-style negatives: `(1234)` → `-1234`. But `(-1234)` (already negative inside parentheses) becomes positive due to double negation. While `(-1234)` is not a common bank format, the function should handle it correctly.

**Fix:** After stripping parentheses, check if the inner value already starts with `-`:
```typescript
const isNeg = (cleaned.startsWith('(') && cleaned.endsWith(')')) || isManeuners || hasTrailingMinus;
if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
  cleaned = cleaned.slice(1, -1);
  // Don't negate if already negative inside parentheses
  if (cleaned.startsWith('-')) isNeg = false;
}
```

---

### CR-40-03: OFX Parser Silently Drops SGML Blocks in Mixed-Format Files
**File:** `packages/parser/src/ofx/index.ts:34-56`
**Severity:** Low | **Confidence:** Medium

```typescript
const xmlPattern = /<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi;
// ...
if (blocks.length === 0) {
  const sgmlPattern = /<STMTTRN[^>]*>([\s\S]*?)(?=<STMTTRN|<\/BANKTRANLIST|...)/gi;
  // ...
}
```

If an OFX file contains BOTH XML-style blocks (`<STMTTRN>...</STMTTRN>`) and SGML-style blocks (`<STMTTRN>...<STMTTRN>`), only the XML ones are extracted. The SGML fallback only runs when `blocks.length === 0`. A malformed or mixed file from a bank could have some XML blocks and some SGML blocks, with the SGML ones silently dropped.

**Fix:** Always run both extractions and merge the results (deduplicating by content hash or index), or remove the conditional and always attempt SGML extraction as a supplement.

---

## CARRYOVER

| ID | Description | File | Status |
|----|-------------|------|--------|
| CR-15 | ReDoS in SUMMARY_ROW_PATTERN | `column-matcher.ts:93` | Still open |
| CR-39-02 | Empty merchant name in ParseError | `xlsx/index.ts:416-422` | Still open |
