# Review Aggregate -- 2026-04-20 (Cycle 53 Re-verification)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle53-comprehensive.md` (full re-read of all 40+ source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-52 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-52 findings are confirmed fixed except as noted below:

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

---

## Prior Findings Now Resolved (This Cycle)

| Finding | Resolution |
|---|---|
| D-107/C52-01 | Web-side CSV adapter error collection -- now collects errors into result |
| C52-02 | `TransactionReview.svelte` AI categorization -- now replaces entries instead of mutating in-place |
| C4-07/C52-06 | `SpendingSummary.svelte` -- now uses `sessionStorage` for dismissal flag |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C53-01 | MEDIUM | HIGH | `apps/web/src/components/dashboard/TransactionReview.svelte:187-205` | `changeCategory` still mutates `editedTxs` entries in-place (same fragile pattern as C52-02, but in a different function); should replace entries like `runAICategorization` does |
| C53-02 | LOW | MEDIUM | `apps/web/src/pages/index.astro:7-16` + `apps/web/src/layouts/Layout.astro:14-24` | Duplicated card stats reading logic with stale fallback values in two files |
| C53-03 | LOW | MEDIUM | `apps/web/src/components/cards/CardDetail.svelte:222` | Performance tier header row uses `text-blue-700` without dark mode variant; poor contrast in dark mode |

---

## Re-articulated Deferred Findings (additional context this cycle)

These are existing deferred items with new failure scenarios or more precise analysis:

| ID | Prior ID | New Context |
|---|---|---|
| C53-01 | C52-02 | The fix for C52-02 only addressed `runAICategorization`; the same in-place mutation pattern persists in `changeCategory` at line 187-205 |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13 | LOW | Small-percentage bars nearly invisible |
| C4-14/C52-04 | LOW | Stale fallback values in Layout footer |
| C9-02/C52-03 | LOW | Redundant comparison UI when savings=0 |
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
