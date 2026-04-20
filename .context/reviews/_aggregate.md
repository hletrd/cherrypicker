# Review Aggregate -- 2026-04-20 (Cycle 3 Re-verification)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle3-comprehensive.md` (full re-read of all 40+ source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-53 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-53 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:262` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:179` uses `formatRatePrecise()` |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C7-13 | **FIXED** | `analyzer.ts:167-168` caches by null check, not reference equality |
| C6R-M01 | **FIXED** | Server-side XLSX uses `Number.isNaN()` |
| C6R-M02 | **FIXED** | Web-side CSV/XLSX use `Number.isNaN()` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C9-01 | **FIXED** | `analyzer.ts:47,167-168` -- `cachedRulesRef` removed, cache uses null check |
| C9-05 | **FIXED** | `store.svelte.ts:419` -- error set when result is null |
| C9-11 | **FIXED** | `store.svelte.ts:143-149` -- non-empty checks for id, date, category |
| C9-13 | **FIXED** | `analyzer.ts:381` -- monthlyBreakdown explicitly sorted by month |
| C10-06 | **FIXED** | `FileDropzone.svelte:211` -- checks `analysisStore.error` after analyze |
| C10-09 | **FIXED** | `store.svelte.ts:363-366` -- reoptimize filters to latest month |
| C10-13 | **FIXED** | `matcher.ts:40` -- guards empty/single-char merchant names |
| C52-01/D-107 | **FIXED** | `csv.ts:966-974` now collects adapter failures into `fallbackResult.errors` |
| C52-02 | **FIXED** | `TransactionReview.svelte:108-130` now uses `updatedTxs.map()` for AI categorization |
| C52-06/C4-07 | **FIXED** | `SpendingSummary.svelte:10,128` now uses `sessionStorage` (not `localStorage`) |
| C53-01 | **FIXED** | `TransactionReview.svelte:187-205` `changeCategory` now uses replacement pattern |
| C53-02 | **FIXED** | Duplicated card stats reading logic extracted to `apps/web/src/lib/build-stats.ts` |
| C53-03 | **FIXED** | `CardDetail.svelte:222` now has `dark:text-blue-300` for dark mode |

---

## Prior Findings Now Resolved (This Cycle)

| Finding | Resolution |
|---|---|
| C53-01 | `changeCategory` in TransactionReview now uses array replacement pattern instead of in-place mutation |
| C53-02 | Card stats reading logic extracted to shared `build-stats.ts` module |
| C53-03 | CardDetail performance tier header now has dark mode contrast variant |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C3-01 | LOW | LOW | `apps/web/src/lib/build-stats.ts:25` | `catch (err)` block logs misleading "not found" message when JSON.parse fails with SyntaxError |
| C3-02 | LOW | LOW | `apps/web/src/components/dashboard/SavingsComparison.svelte:53-70` | Count-up animation $effect creates unnecessary RAF loop when target === displayedSavings |
| C3-03 | MEDIUM | MEDIUM | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:153-161` | Keyboard accessibility issue: hoveredIndex set by mouse events doesn't collapse on keyboard focus loss |
| C3-04 | LOW | MEDIUM | `apps/web/src/components/dashboard/OptimalCardMap.svelte:17-24` | Rate bar visual distortion when all rates are near-zero (epsilon too small) |
| C3-05 | LOW | HIGH | `apps/web/src/lib/store.svelte.ts:405-420` | Missing sessionStorage cleanup when reoptimize fails with null result |

---

## Re-articulated Deferred Findings (additional context this cycle)

These are existing deferred items with new failure scenarios or more precise analysis:

| ID | Prior ID | New Context |
|---|---|---|
| C3-05 | C9-05 | C9-05 fixed the "error set when result is null" issue, but C3-05 identifies a related gap: the stale sessionStorage data is NOT cleared when reoptimize fails, which can confuse users on page refresh |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13 | LOW | Small-percentage bars nearly invisible |
| C4-14/C52-04 | LOW | Stale fallback values in Layout footer (partially addressed by shared module) |
| C9-04 | LOW | Complex fallback date regex in PDF parser |
| C9-06 | LOW | Percentage rounding can shift "other" threshold |
| C9-07 | LOW | Math.max spread stack overflow risk (theoretical) |
| C9-08 | LOW | Comparison bars misleading when both rewards are 0 |
| C9-09 | LOW | Categories cache never invalidated (same as D-07/D-54) |
| C9-10 | LOW | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12 | LOW | Module-level cache persists across store resets |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
