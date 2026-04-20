# Review Aggregate -- 2026-04-20 (Cycle 11)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle11-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-53 per-agent and aggregate files
- Cycle 10 aggregate (previously `_aggregate.md`)
- Cycle 53 comprehensive (2026-04-20-cycle53-comprehensive.md)

---

## Verification of Prior Cycle Fixes

All prior cycle 1-10 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:263` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:180` uses `formatRatePrecise()` |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C7-09 | **FIXED** | `formatDateKo`/`formatDateShort` now have `Number.isNaN` guards |
| C8-03 | **FIXED** | `SpendingSummary.svelte:123` now uses year-aware month diff `(y1-y2)*12+(m1-m2)` |
| C8-12 | **FIXED** | `persistToStorage` now returns `PersistWarningKind` directly; `_loadPersistWarningKind` properly consumed and reset |
| C9-01 | **FIXED** | `analyzer.ts` cache uses null check, `cachedRulesRef` removed |
| C9-03 | **FIXED** | `detect.ts` tie-breaking documented |
| C9-05 | **FIXED** | `store.svelte.ts` error set when result is null in reoptimize |
| C9-11 | **FIXED** | `store.svelte.ts` `isValidTx` has non-empty checks for id, date, category |
| C9-13 | **FIXED** | `analyzer.ts` monthlyBreakdown explicitly sorted by month |
| C10-01 | **FIXED** | `SpendingSummary.svelte:10-18` has try/catch around sessionStorage reads in onMount; `SpendingSummary.svelte:139` has try/catch around sessionStorage writes in dismiss handler |
| C10-03 | **PARTIALLY FIXED** | `pdf.ts:264-273` now reports errors for unparseable amounts in structured parse, but fallback path (lines 352-394) still silently skips unparseable amounts without error reporting (see C11-03) |
| C52-02 | **FIXED** | `TransactionReview.svelte:108-130` uses `updatedTxs.map()` to replace entries instead of mutating in-place |
| C53-01 | **FIXED** | `TransactionReview.svelte:120-139` `changeCategory` now uses replacement pattern (`editedTxs = editedTxs.map(...)`) |
| C8-02/C9R-02 | **FIXED** | `CardDetail.svelte:82-95` now has AbortController cleanup on unmount via `$effect` return cleanup |
| C7-04 | **OPEN (LOW)** | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-06 | **OPEN (LOW)** | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | **OPEN (LOW)** | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-10 | **OPEN (LOW)** | CategoryBreakdown percentage rounding can cause total > 100% |
| C7-11 | **OPEN (LOW)** | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | **OPEN (MEDIUM)** | AI categorizer disabled but 65+ lines of unreachable dead code |
| C8-05 | **OPEN (LOW)** | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast (extends C4-09) |
| C8-06 | **OPEN (LOW)** | FileDropzone + CardDetail use full page reload navigation (extends C7-12) |
| C8-07 | **OPEN (LOW)** | build-stats.ts fallback values will drift (extends C4-14) |
| C8-08 | **OPEN (LOW)** | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | **OPEN (LOW)** | Test duplicates production code instead of testing it directly |
| C8-10 | **OPEN (LOW)** | csv.ts installment NaN implicitly filtered by `> 1` comparison |
| C8-11 | **OPEN (LOW)** | pdf.ts fallback date regex could match decimal numbers like "3.5" |
| C9R-03 | **OPEN (LOW)** | pdf.ts negative amounts (refunds) silently dropped |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C11-01 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:378` vs `apps/web/src/lib/analyzer.ts:304` | `Math.abs(tx.amount)` used in `reoptimize` monthly spending calculation but NOT in `analyzeMultipleFiles` monthly spending calculation. Inconsistency could cause monthly breakdown numbers to diverge after editing if negative-amount transactions are present. |
| C11-02 | LOW | Low | `apps/web/src/components/cards/CardDetail.svelte:276`, `apps/web/src/components/upload/FileDropzone.svelte:217` | `window.location.href = import.meta.env.BASE_URL + 'cards'` relies on BASE_URL having trailing slash. Astro guarantees this, but the pattern is fragile if config changes. Other locations use `${base}cards` template literal with base having trailing slash. |
| C11-03 | LOW | Medium | `apps/web/src/lib/parser/pdf.ts:352-394` | PDF fallback parsing path does not report errors for unparseable amounts. When `parseAmount` returns 0 from a non-zero input, the transaction is silently skipped with no error reported. This is a remaining gap from C10-03 which was partially fixed for the structured path only. |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/C8-05 | LOW | Hardcoded CATEGORY_COLORS in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C4-14/D-44/C8-07 | LOW | Stale fallback values in Layout footer / build-stats |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-10 | LOW | CategoryBreakdown percentage rounding can cause total > 100% |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C7-12/C8-06 | LOW | CardDetail + FileDropzone use full page reload |
| C7-13 | LOW | toCoreCardRuleSets cache keyed by reference equality (now uses null check, improved) |
| C8-01 | MEDIUM | AI categorizer disabled but dead code in TransactionReview |
| C8-08 | LOW | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code |
| C8-10 | LOW | csv.ts installment NaN fragile implicit filter |
| C8-11 | LOW | pdf.ts fallback date regex could match decimals |
| C9R-03 | LOW | pdf.ts negative amounts (refunds) silently dropped |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:296` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |
| D-66 | LOW | CardGrid issuer filter shows issuers with 0 cards after type filter |
| D-01 through D-111 | Various | See deferred items file for full list |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03 | LOW | CardDetail performance tier header dark mode contrast |
| C10-03 | LOW | PDF parseAmount: structured path now reports errors, fallback path still silent (superseded by C11-03) |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
