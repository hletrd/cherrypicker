# Debugger Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Reviewer:** debugger
**Cycle:** 41 / 100

---

## Verified Fixed

| ID | Finding | Evidence |
|----|---------|----------|
| BUG-40-02 | `parseAmountString('(-1234)')` returned positive 1234 | `csv/shared.ts:170-172` now sets `isNeg = false` when inner value starts with `-` |
| BUG-40-01 | NaN in sessionStorage caused `reoptimize()` crash | `store.svelte.ts:347-350` now validates with `Number.isFinite()` |

---

## New Findings

### BUG-41-01: OFX date timezone shift for time-only entries without timezone (Medium)

**File:** `packages/parser/src/ofx/index.ts:88-115` and `apps/web/src/lib/parser/ofx.ts:57-84`
**Confidence:** High

When OFX DTPOSTED includes time but no timezone (e.g., `20240115230000`), the parser treats the time as UTC and adds 9 hours for KST conversion. For a 23:00 KST transaction, this becomes 23:00 UTC + 9h = 08:00 next day UTC, so `getUTCDate()` returns the next day.

**Failure scenario:** User uploads a credit card OFX with late-night transactions. The dates appear shifted forward by one day, distorting the monthly breakdown and statement period.

**Fix:** Distinguish between "no timezone specified" (tzOffset undefined) and "timezone is GMT+0" (tzOffset = 0). Only apply the +9h conversion when a timezone offset is explicitly present.

---

### BUG-41-02: `analyzeMultipleFiles` fails entire batch on single file error (Medium)

**File:** `apps/web/src/lib/analyzer.ts:315-317`
**Confidence:** Medium

```typescript
const allParsed = await Promise.all(
  files.map((f, i) => parseAndCategorize(f, options, i, sharedMatcher, categoryNodes))
);
```

If one file throws (e.g., `parseFile` throws or `parseAndCategorize` throws because `transactions.length === 0`), the entire `Promise.all` rejects and no results from other files are returned.

**Failure scenario:** User uploads 5 statement files, one is a corrupt PDF. All 5 files fail to analyze with a generic error, and the user cannot tell which file caused the problem.

**Fix:** Wrap each `parseAndCategorize` call in a try/catch, collect per-file errors, and proceed with successfully parsed files. Include per-file error info in the returned `parseErrors` array.

---

### BUG-41-03: `parseAmountString` silent precision loss above MAX_SAFE_INTEGER (Low)

**File:** `packages/parser/src/csv/shared.ts:188-191`
**Confidence:** High

`Math.round(parseFloat(cleaned))` on values above `Number.MAX_SAFE_INTEGER` silently loses precision. The test at `apps/web/__tests__/amount.test.ts:104-105` documents this as expected behavior, but it's a data integrity issue.

**Failure scenario:** A user parses a corporate card statement with a multi-trillion Won transaction. The amount is silently rounded, affecting the optimization result.

**Fix:** Add a check: if `parseFloat(cleaned) > Number.MAX_SAFE_INTEGER`, return null and emit a ParseError.

---

## Carryover Bugs (still latent)

| ID | Description | File | Severity |
|----|-------------|------|----------|
| BUG-3 | NaN propagation in `previousMonthSpending` — core fixed, store gap remains | `store.svelte.ts` | High |
| BUG-4 | EUC-KR HTML detection failure | `xlsx.ts:99` | High |
| BUG-7 | OFX credits silently skipped | `ofx.ts:146` | Medium |
