# Comprehensive Code Review -- Cycle 9 Re-Re-Review (2026-04-20)

**Reviewer:** Deep re-review (cycle 9, current session)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Focus:** New findings beyond cycles 1-8+prior-9; verification of all prior fixes; deep analysis of edge cases and cross-file interactions

---

## Methodology

Re-read all key source files across apps/web (store.svelte.ts, analyzer.ts, all parser files, all dashboard components, all card components, formatters, cards.ts, api.ts, build-stats.ts, categorizer-ai.ts, Layout.astro). Cross-referenced with prior cycle 1-53 reviews, the aggregate, deferred items, and existing plans. Ran `grep` for patterns: `window.location.href`, `sessionStorage`, `catch {`, to identify systematic issues.

---

## Verification of Prior Cycle Fixes

### Cycle 8 Fixes (re-verified)

| Finding | Status | Evidence |
|---|---|---|
| C8-01 | **OPEN (MEDIUM)** | AI categorizer still disabled, dead code still present in TransactionReview.svelte (lines 6-10, 46-151) |
| C8-02 | **OPEN (MEDIUM)** | CardDetail.svelte:77-93 $effect uses `cancelled` flag for cleanup but no AbortController. Fetch not abortable. |
| C8-03 | **OPEN (LOW)** | SpendingSummary.svelte:119-123 still uses year-aware month diff (partially fixed -- now uses (y1-y2)*12+(m1-m2) at line 123) |
| C8-10 | **OPEN (LOW)** | csv.ts installment parsing still relies on `NaN > 1 === false` implicit filter |
| C8-11 | **OPEN (LOW)** | pdf.ts:342 fallback date regex still could match decimal numbers |
| C8-12 | **OPEN (LOW)** | store.svelte.ts now has `persistToStorage` returning `PersistWarningKind` directly (line 107-137) -- this was FIXED. The return value is used at line 332. `_loadPersistWarningKind` still exists (line 157) but is now properly consumed and reset. |

### Cycle 9 Prior Fixes (re-verified)

| Finding | Status | Evidence |
|---|---|---|
| C9-01 | **FIXED** | `analyzer.ts:47,167-168` -- `cachedRulesRef` removed, cache uses null check only |
| C9-02 | **DEFERRED** | UX enhancement -- redundant comparison UI when savings=0 |
| C9-03 | **FIXED** | `detect.ts` -- tie-breaking documented |
| C9-04 | **DEFERRED** | Maintainability concern -- regex works correctly |
| C9-05 | **FIXED** | `store.svelte.ts:419` -- error set when result is null |
| C9-06 | **DEFERRED** | Minor rounding threshold shift |
| C9-07 | **DEFERRED** | Theoretical stack overflow for extremely large arrays |
| C9-08 | **DEFERRED** | Comparison bars misleading when both rewards are 0 |
| C9-09 | **DEFERRED** | Same class as D-07/D-54 |
| C9-10 | **DEFERRED** | Minor perf optimization -- double decode in HTML-as-XLS |
| C9-11 | **FIXED** | `store.svelte.ts:143-149` -- non-empty checks for id, date, category |
| C9-12 | **DEFERRED** | Module-level cache persists across resets |
| C9-13 | **FIXED** | `analyzer.ts:357` -- monthlyBreakdown explicitly sorted by month |
| C9R-01 | **DEFERRED** | Day validation `<= 31` -- documented tradeoff |

---

## New Findings

### C9R-02: CardDetail.svelte $effect cleanup uses `cancelled` flag but fetch still runs to completion

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/cards/CardDetail.svelte:77-93`
- **Description:** The `$effect` at line 77 increments `fetchGeneration` and sets a `cancelled` flag. The cleanup function at line 93 sets `cancelled = true`. When the cardId changes or the component is destroyed, the `cancelled` flag prevents stale state updates, which is correct. However, the `getCardDetail(cardId)` fetch itself continues running to completion -- the network request is not aborted. With `AbortController`, the fetch could be cancelled at the network level, saving bandwidth and avoiding unnecessary work. The current `cancelled` flag approach is functionally correct for state consistency but wasteful for network resources. This extends C8-02/D-62/D-105.
- **Failure scenario:** User quickly clicks through 5 different cards on the cards page. Five fetch requests are fired, all run to completion, but only the last one's result is used. The other 4 responses are discarded by the `cancelled` flag. On slow connections, this wastes bandwidth.
- **Fix:** Use `AbortController` in the `$effect`:
  ```typescript
  $effect(() => {
    if (!cardId) { loading = false; return; }
    loading = true; error = null;
    const gen = ++fetchGeneration;
    const controller = new AbortController();
    getCardDetail(cardId, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted && gen === fetchGeneration) card = result; })
      .catch(e => { if (!controller.signal.aborted && gen === fetchGeneration) error = e instanceof Error ? e.message : '카드 정보를 불러올 수 없어요'; })
      .finally(() => { if (!controller.signal.aborted && gen === fetchGeneration) loading = false; });
    return () => controller.abort();
  });
  ```
  This requires `getCardDetail` in api.ts to accept and forward an `AbortSignal` to `getCardById` in cards.ts, and ultimately to the `fetch()` call in `loadCardsData()`.

### C9R-03: `parseAmount` in pdf.ts returns 0 for unparseable amounts -- silently drops transactions with negative amounts

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/pdf.ts:207-213`
- **Description:** `parseAmount` returns 0 for unparseable amounts (`Number.isNaN(n) ? 0 : n`). The structured parser at line 262 checks `if (amount <= 0 || (!merchant && amount === 0)) continue;`, which correctly skips 0-amount and negative-amount transactions. However, the fallback parser at line 362 checks `if (amount > 0)`, which also skips 0 and negative. This means: (1) A legitimate refund transaction (negative amount) is silently dropped, and (2) The user gets no feedback that a negative-amount line was skipped. Korean credit card statements sometimes include refund/cancellation entries with negative amounts, which are currently lost.
- **Failure scenario:** A PDF statement contains "03/15 넷플릭스 -14,900원" (a Netflix refund). `parseAmount` returns -14900. The fallback parser's `if (amount > 0)` check skips it. The user's transaction count is lower than expected and the refund is missing from the analysis.
- **Fix:** In the fallback parser, consider including negative amounts as well (e.g., `if (amount !== 0)` instead of `if (amount > 0)`). Or add a separate `isRefund` flag to `RawTransaction` for negative amounts. At minimum, add a warning when negative amounts are encountered.

### C9R-04: `SavingsComparison.svelte` annual projection multiplies by 12 regardless of whether data spans a full month

- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:205`
- **Description:** Line 205 computes `연간 약 ${formatWon(savingsVsSingleCard * 12)}`. If the uploaded statement covers only 15 days of a month, the annual projection `savings * 12` overestimates by roughly 2x. This extends D-40/D-82/C4-06. The "약" label makes it clear this is an estimate, but the estimate quality degrades significantly for partial-month data. With the `statementPeriod` available in the store, it would be possible to prorate the projection.
- **Failure scenario:** User uploads a statement from Jan 15 to Jan 31 (17 days). Monthly savings is 50,000 won. Annual projection shows "연간 약 600,000원" but the actual annualized amount based on the 17-day period would be ~1,076,000 won (50,000 * 365/17).
- **Fix:** Prorate the annual projection based on the number of days in the statement period, or add a note when the period is less than 28 days. Alternatively, simply accept this as an approximation and document the tradeoff.

---

## Prior Findings Still Open (Not Yet Addressed)

| ID | Severity | Description | Status |
|---|---|---|---|
| C8-01 | MEDIUM | AI categorizer disabled, 65+ lines dead code in TransactionReview | OPEN |
| C8-02/C9R-02 | MEDIUM | CardDetail $effect fetch not abortable on unmount | OPEN (extended) |
| C8-03 | LOW | SpendingSummary month diff -- partially fixed with year-aware calc | MOSTLY FIXED |
| C8-10 | LOW | csv.ts installment NaN implicitly filtered by `> 1` | OPEN |
| C8-11 | LOW | pdf.ts fallback date regex could match decimal numbers | OPEN |

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations:** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

2. **All `formatRate`/`formatRatePrecise` implementations:** All have `Number.isFinite` guard. Consistent.

3. **`parseDateToISO` implementations (6+ locations):** All have month/day range validation. Day validation uses `<= 31` (C9R-01 deferred).

4. **`inferYear` implementations (3 web-side locations: csv.ts, xlsx.ts, pdf.ts):** All use the same 90-day look-back heuristic. Consistent.

5. **SessionStorage validation:** `isValidTx` has non-empty checks for id, date, category, plus `Number.isFinite(tx.amount)` and `tx.amount > 0`. Correct.

6. **`persistToStorage` now returns `PersistWarningKind`:** The C8-12 fix changed this to return the warning kind directly instead of using a shared mutable variable. The `setResult`, `analyze`, and `reoptimize` methods all use the return value. The `_loadPersistWarningKind` module variable is still used for the load-time path but is properly consumed and reset. This is a significant improvement over the prior pattern.

7. **SpendingSummary month diff:** Now correctly uses `(y1 - y2) * 12 + (m1 - m2)` at line 123, handling year boundaries. The C8-03 finding is now addressed.

8. **XLSX parser `parseInstallments`:** Now explicitly checks `!Number.isNaN(n) && n > 1` at line 304, addressing the C8-10 concern for the XLSX path. The CSV path still relies on the implicit `NaN > 1 === false` filter.

---

## Summary of New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C9R-02 | MEDIUM | High | `CardDetail.svelte:77-93` | $effect fetch not abortable -- `cancelled` flag prevents stale state but network request continues (extends C8-02/D-62/D-105) |
| C9R-03 | LOW | High | `pdf.ts:207-213,362` | `parseAmount` returns 0 for NaN; negative amounts (refunds) silently dropped |
| C9R-04 | LOW | High | `SavingsComparison.svelte:205` | Annual projection multiplies by 12 regardless of data span (extends D-40/D-82/C4-06) |

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C8-01: Remove or clearly gate dead AI categorization code in TransactionReview (carried from C8)
2. C9R-02: Add AbortController to CardDetail fetch (extends C8-02)

### MEDIUM (plan for next cycles)
3. C8-10: Add explicit NaN guard to csv.ts installment parsing
4. C9R-03: Handle negative amounts in PDF parser (refund transactions)

### LOW (defer or accept)
- C8-11, C9R-04, and all prior deferred items

---

## Deferred items carried forward

All deferred items from cycles 1-9 (D-01 through D-111, plus LOW findings) remain unchanged. No new deferred items this cycle beyond the LOW findings listed above.
