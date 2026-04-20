# Review Aggregate -- 2026-04-20 (Cycle 8)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle8-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-53 per-agent and aggregate files
- Cycle 7 aggregate (2026-04-20-cycle7-comprehensive.md)

---

## Verification of Prior Cycle Fixes

All prior cycle 1-7 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:263` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:180` uses `formatRatePrecise()` |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C7-09 | **FIXED** | `formatDateKo`/`formatDateShort` now have `Number.isNaN` guards |
| C7-04 | **OPEN (LOW)** | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-05 | **OPEN (LOW)** | `_persistWarningKind` module-level mutable variable -- see C8-12 |
| C7-06 | **OPEN (LOW)** | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | **OPEN (LOW)** | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-10 | **OPEN (LOW)** | CategoryBreakdown percentage rounding can cause total > 100% |
| C7-11 | **OPEN (LOW)** | persistWarning message misleading for data corruption vs size truncation |
| C7-12 | **OPEN (LOW)** | CardDetail uses full page reload -- see C8-06 |
| C7-13 | **OPEN (LOW)** | toCoreCardRuleSets cache never hits due to reference equality -- now uses null check |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C8-01 | MEDIUM | High | `apps/web/src/components/dashboard/TransactionReview.svelte:49,77-143,262` | AI categorizer disabled but 65+ lines of unreachable dead code |
| C8-02 | MEDIUM | High | `apps/web/src/components/cards/CardDetail.svelte:77-92` | $effect fetch not abortable on unmount -- no AbortController, no cleanup return |
| C8-03 | LOW | High | `apps/web/src/components/dashboard/SpendingSummary.svelte:119-121` | Month diff breaks on year boundaries (Dec 2025 -> Jan 2026 shows wrong label) |
| C8-05 | LOW | High | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49` | CATEGORY_COLORS poor dark mode contrast for gray-toned categories (extends C4-09) |
| C8-06 | LOW | High | `FileDropzone.svelte:217` + `CardDetail.svelte:272` | Full page reload navigation instead of Astro navigate() (extends C7-12) |
| C8-07 | LOW | High | `apps/web/src/lib/build-stats.ts:16-18` | Stale fallback values will drift from actual data (extends C4-14) |
| C8-08 | LOW | Medium | `pdf.ts:137-144` + `xlsx.ts:183-190` | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | High | `apps/web/__tests__/analyzer-adapter.test.ts:22-72` | Test duplicates production code instead of testing it directly |
| C8-10 | LOW | High | `apps/web/src/lib/parser/csv.ts:257,334,etc` | Installment NaN implicitly filtered by `> 1` comparison -- fragile |
| C8-11 | LOW | Medium | `apps/web/src/lib/parser/pdf.ts:342` | Fallback date regex could match decimal numbers like "3.5" |
| C8-12 | LOW | High | `apps/web/src/lib/store.svelte.ts:106,157` | _persistWarningKind module-level mutable variable (extends C7-05) |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/D-96/C8-05 | LOW | Hardcoded CATEGORY_COLORS in CategoryBreakdown (dark mode contrast) |
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
| C8-08 | LOW | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code |
| C8-10 | LOW | csv.ts installment NaN fragile implicit filter |
| C8-11 | LOW | pdf.ts fallback date regex could match decimals |
| C8-12/C7-05 | LOW | _persistWarningKind module-level mutable variable |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |
| D-66 | LOW | CardGrid issuer filter shows issuers with 0 cards after type filter |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
