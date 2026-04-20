# Review Aggregate -- 2026-04-20 (Cycle 7)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle7-comprehensive.md` (full re-read of all 40+ source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-53 per-agent and aggregate files
- Cycle 6 aggregate (2026-04-20-cycle6-comprehensive.md)

---

## Verification of Prior Cycle Fixes

All prior cycle 1-53 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:262` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:179` uses `formatRatePrecise()` |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C9-01 | **FIXED** | `analyzer.ts:47` -- `cachedCoreRulesRef` removed, cache uses null check |
| C9-05 | **FIXED** | `store.svelte.ts:419` -- error set when result is null |
| C9-11 | **FIXED** | `store.svelte.ts:143-149` -- non-empty checks for id, date, category |
| C9-13 | **FIXED** | `analyzer.ts:381` -- monthlyBreakdown explicitly sorted by month |
| C10-03 | **FIXED** | `xlsx.ts:195` -- `Number.isFinite(raw)` check added |
| C10-06 | **FIXED** | `FileDropzone.svelte:211` -- checks `analysisStore.error` after analyze |
| C10-09 | **FIXED** | `store.svelte.ts:363-366` -- reoptimize filters to latest month |
| C10-13 | **FIXED** | `matcher.ts:40` -- guards empty/single-char merchant names |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C52-01/D-107 | **FIXED** | `csv.ts:966-974` now collects adapter failures into `fallbackResult.errors` |
| C52-02 | **FIXED** | `TransactionReview.svelte:108-130` now uses `updatedTxs.map()` for AI categorization |
| C52-06/C4-07 | **FIXED** | `SpendingSummary.svelte:10,128` now uses `sessionStorage` (not `localStorage`) |
| C53-01 | **FIXED** | `TransactionReview.svelte:187-205` `changeCategory` now uses replacement pattern |
| C53-02 | **FIXED** | Duplicated card stats reading logic extracted to `apps/web/src/lib/build-stats.ts` |
| C53-03 | **FIXED** | `CardDetail.svelte:222` now has `dark:text-blue-300` for dark mode |
| C4-01 | **FIXED** | `build-stats.ts:25-30` catch block now differentiates ENOENT, EACCES, and other errors |
| C5-01 | **FIXED** | `SpendingSummary.svelte:119-121` now has `Number.isFinite` guard on `parseInt` results |
| C6-03 | **FIXED** | `analyzer.ts:300-302` has length guard `if (!tx.date || tx.date.length < 7) continue;` |

---

## Re-analyzed Prior Findings (downgraded this cycle)

| Finding | Prior Status | New Assessment |
|---|---|---|
| C3-02 | LOW/LOW | NOT A REAL ISSUE -- The "duplicate guard" in SavingsComparison count-up is a correct early-return pattern |
| C3-03 | MEDIUM/MEDIUM | NOT A REAL ISSUE -- Keyboard accessibility works correctly via onfocusin/onfocusout combination |
| C3-05 | LOW/HIGH | NOT A REAL ISSUE -- Reoptimize catch correctly preserves old result; clearing sessionStorage would destroy valid data |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C7-01 | LOW | MEDIUM | `apps/web/__tests__/analyzer-adapter.test.ts:236,271` | Test `slice(0, 7)` without length guard, inconsistent with production code |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/D-96 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C4-14/D-44 | LOW | Stale fallback values in Layout footer |
| C9-04/D-71 | LOW | Complex fallback date regex in PDF parser |
| C9-06/D-59/D-72 | LOW | Percentage rounding can shift "other" threshold |
| C9-07/D-73/D-89 | LOW | Math.max spread stack overflow risk (theoretical) |
| C9-09/D-07/D-54 | LOW | Categories cache never invalidated |
| C9-10/D-52/D-75 | LOW | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12/D-76 | LOW | Module-level cache persists across store resets |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |
| D-66 | LOW | CardGrid issuer filter shows issuers with 0 cards after type filter |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
