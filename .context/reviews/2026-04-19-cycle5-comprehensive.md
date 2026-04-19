# Comprehensive Code Review -- Cycle 5 (Re-review)

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 5 re-review)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage, type safety

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-50 reviews and deferred items. Ran `bun test` (266 pass, 0 fail), `tsc --noEmit` per package (all pass), and `bun run build` (all 7 tasks succeed). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Findings

All prior cycle 4/47-50 findings are confirmed fixed:

| Finding | Status | Evidence |
|---|---|---|
| C4-01 | **FIXED** | `SavingsComparison.svelte` has `Number.isFinite(raw)` guard |
| C4-02 | **FIXED** | `analyzeMultipleFiles` passes prebuilt `categoryLabels` to `optimizeFromTransactions` |
| C4-03 | **FIXED** | Single-pass `monthlyTxCount` map in `analyzer.ts:298-302` |
| C4-04 | **FIXED** | `CategoryBreakdown.svelte` has `role="button"` and `tabindex="0"`, `onkeydown` |
| C4-05 | **FIXED** | `analyzer.ts:225` passes `categoryLabels` directly to `buildConstraints` |
| C4-08 | **FIXED** | `TransactionReview.svelte` uses `lastSyncedGeneration` counter |
| C4-12 | **FIXED** | `FileDropzone.svelte` uses `Math.round(Number(v))` with `Number.isFinite` guard |
| C4-15 | **FIXED** | `analyzer.ts:47,167-168` caches `cachedCoreRules` |
| C4R-M01 | **FIXED** | `report.ts:143` calls `printSpendingSummary(categorized, categoryLabels)` |
| C4R-M02 | **FIXED** | Server-side CSV adapter `parseAmount` returns 0 instead of NaN |
| C4R-L01 | **FIXED** | Content-signature adapter failures collected into `ParseResult.errors` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |
| C50-M01 | **STILL FIXED** | Viz report generator and terminal summary accept `categoryLabels` parameter |
| C50-L01 | **STILL FIXED** | Report generator uses `replaceAll()` for template placeholder substitution |
| C5-01 (old) | **FIXED** | `reoptimize()` now increments `generation` (line 414) |
| C5-03 (old) | **FIXED** | OptimalCardMap rows have `role="button"` and `tabindex="0"` (lines 97-98) |

Still-open items from prior cycles:

| Finding | Status | Note |
|---|---|---|
| C4-06 | **STILL OPEN** | Annual savings projection label unchanged (LOW) |
| C4-07 | **STILL OPEN** | localStorage vs sessionStorage inconsistency in SpendingSummary (LOW) |
| C4-09 | **STILL OPEN** | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (LOW) |
| C4-10 | **STILL OPEN** | E2E test stale dist/ dependency (MEDIUM) |
| C4-11 | **STILL OPEN** | No regression test for findCategory fuzzy match (MEDIUM) |
| C4-13 | **STILL OPEN** | Small-percentage bars nearly invisible (LOW) |
| C4-14 | **STILL OPEN** | Stale fallback values in Layout footer (LOW) |

---

## New Findings

### C5-M01: Server-side CSV adapter `parseAmount` returns 0 on NaN, but callers still check `isNaN()` -- dead code, invalid amounts silently become 0-amount transactions

- **Severity:** MEDIUM (dead code / silent data corruption)
- **Confidence:** High
- **File+line:** `packages/parser/src/csv/shinhan.ts:24-31,97-103` and all 10 server-side CSV adapters
- **Description:** Each server-side CSV adapter's `parseAmount` function returns 0 on NaN (`if (isNaN(n)) return 0;`), but the calling code still checks `if (isNaN(amount))` after calling `parseAmount`. Since `parseAmount` never returns NaN, the `isNaN(amount)` check in the caller is dead code -- it will never be true. This means invalid amounts are silently swallowed (amount becomes 0, transaction is included with 0 amount).

  Compare with the web-side `apps/web/src/lib/parser/csv.ts` which has a separate `isValidAmount` helper that uses `Number.isNaN` against the raw `parseAmount` result (which CAN return NaN on the web side since web `parseAmount` returns NaN for unparseable values).

  The server-side fix (cycle 4) changed `parseAmount` to return 0 instead of NaN, but did not update the callers that still check for NaN. The result: invalid amounts are now included as 0-amount transactions instead of being rejected with an error.

- **Concrete failure scenario:** A CSV row with amount "abc" would previously be rejected with an error. Now it becomes a transaction with `amount: 0`, which passes through to the optimizer (filtered by `amount > 0` in greedy, but still stored in `transactions[]` and displayed in spending summary with 0 amount).

- **Fix:** Change `parseAmount` back to return NaN on parse failure (matching the web-side behavior), and use the `isValidAmount` helper pattern (like the web side does) to check for NaN and push errors. This restores the error-reporting behavior while being consistent with the web-side parser.

### C5-M02: `isNaN()` used instead of `Number.isNaN()` in all server-side CSV adapters

- **Severity:** MEDIUM (consistency / best practice)
- **Confidence:** High
- **File+line:** `packages/parser/src/csv/shinhan.ts:29` and all 10 server-side CSV adapters
- **Description:** `isNaN()` coerces its argument to Number before checking, which can produce unexpected results. `Number.isNaN()` only returns `true` for actual NaN values and does not coerce. The web-side `apps/web/src/lib/parser/csv.ts` correctly uses `Number.isNaN()` and `isValidAmount()`. The server-side PDF parser also correctly uses `Number.isNaN()` at `packages/parser/src/pdf/index.ts:107`. All 10 server-side CSV adapters use `isNaN()` inconsistently.

- **Concrete failure scenario:** While `parseInt` always returns a number (so `isNaN` and `Number.isNaN` are functionally equivalent here), using `isNaN` is inconsistent with the rest of the codebase and could become a real bug if `parseAmount` were ever refactored.

- **Fix:** Replace all `isNaN(n)` with `Number.isNaN(n)` in the server-side CSV adapter `parseAmount` functions and their callers. This aligns with the PDF parser and web-side CSV parser.

### C5-L01: Duplicate `splitLine` and `parseDateToISO` implementations across web and server parser (extends D-01)

- **Severity:** LOW (maintainability / consistency risk)
- **Confidence:** High
- **File+line:** `packages/parser/src/csv/shinhan.ts:33-48` vs `apps/web/src/lib/parser/csv.ts:8-23`
- **Description:** Already tracked as D-01. Noting that the individual bank adapters have simpler `parseDateToISO` (missing YY-MM-DD, Korean short dates, MM/DD formats) while the generic adapter and web-side have comprehensive coverage. This could cause date parsing failures for some formats when a bank-specific adapter is used.

- **Fix:** Already deferred as D-01. No new action needed.

### C5-L02: `table-parser.ts` uses `nextCount` variable that is declared but never used

- **Severity:** LOW (dead code)
- **Confidence:** High
- **File+line:** `packages/parser/src/pdf/table-parser.ts:37`
- **Description:** The `detectColumnBoundaries` function reads `charCount[i + 1]` into `nextCount` but never uses it. Only `prevCount` and `count` are used in the boundary detection logic.

- **Concrete failure scenario:** No functional impact -- just dead code that could confuse future readers.

- **Fix:** Remove the unused `nextCount` variable from line 37.

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations are consistent** -- all 4 implementations have `Number.isFinite` guards and negative-zero normalization.
2. **All `formatRate` implementations are consistent** -- all 5 implementations have `Number.isFinite` guards.
3. **TypeScript build is clean** for all packages.
4. **266 tests pass**, 0 fail.
5. **Reward calculation consistency** -- all calculator functions delegate correctly.
6. **Category labels resolution** is consistent across CLI, viz, and web.
7. **`reoptimize()` now increments `generation`** -- C5-01 (old) is fixed.
8. **OptimalCardMap has keyboard accessibility** -- C5-03 (old) is fixed.
9. **No new security issues found.** CSP present, LLM fallback guarded, no secrets.
10. **No new performance issues found.**
11. **No new UI/UX issues found.** All dashboard components render correctly.

---

## Summary of Active Findings

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C5-M01 | MEDIUM | High | `packages/parser/src/csv/*.ts` (all 10 adapters) | Server-side CSV `parseAmount` returns 0 on NaN but callers still check `isNaN()` -- dead code, invalid amounts silently become 0 | NEW, needs fix |
| C5-M02 | MEDIUM | High | `packages/parser/src/csv/*.ts` (all 10 adapters) | `isNaN()` used instead of `Number.isNaN()` -- inconsistent with PDF parser and web-side | NEW, consistency fix |
| C5-L01 | LOW | High | `packages/parser/src/csv/*.ts` vs `apps/web/src/lib/parser/csv.ts` | Duplicate parser logic with inconsistent date coverage (already D-01) | Already deferred |
| C5-L02 | LOW | High | `packages/parser/src/pdf/table-parser.ts:37` | Unused `nextCount` variable (dead code) | NEW, low priority |
