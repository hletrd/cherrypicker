# Review Aggregate -- 2026-04-20 (Cycle 24)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle24-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-23 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-23 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | OPEN (MEDIUM) | AI categorizer disabled but ~40 lines of unreachable dead code stub |
| C8-05/C4-09 | OPEN (LOW) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C8-10 | **FIXED** | csv.ts installment NaN now has explicit check with comment (C21 fix) |
| C8-11 | **FIXED** | pdf.ts fallback date regex now uses `isValidShortDate()` helper (C21 fix) |
| C18-01 | OPEN (MEDIUM) | VisibilityToggle $effect directly mutates DOM; now uses cached refs with isConnected check (C21-01 fix) but pattern remains fragile |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements with isConnected check (C21 fix), but getElementById pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-03 | **FIXED** | csv.ts parseAmount now uses `Math.round(parseFloat(...))` |
| C21-04 | OPEN (LOW) | cachedCategoryLabels never invalidated (deferred) |
| C21-05 | **FIXED** | FileDropzone now uses separate primaryFileInputEl and addFileInputEl refs |
| C20-02 | OPEN (LOW) | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04 | OPEN (LOW) | pdf.ts module-level regex constants not shared with date-utils.ts |
| C22-01 | **FIXED** | pdf.ts parseAmount now uses `Math.round(parseFloat(...))` |
| C22-02 | **FIXED** | SavingsComparison now checks prefers-reduced-motion |
| C22-03 | **FIXED** | persistToStorage now tracks truncatedTxCount in PersistResult |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C23-01 | **FIXED** | greedy.ts now uses `Number.isFinite(tx.amount)` guard alongside `tx.amount > 0` |
| C23-02 | OPEN (LOW) | `analyzer.ts:47` cachedCoreRules never invalidated -- same class as C21-04 |
| C23-03 | **FIXED** | SpendingSummary monthDiff NaN now guarded by `Number.isFinite()` check |
| C23-04 | OPEN (LOW) | csv.ts generic header detection heuristic (low risk) |
| C23-05 | OPEN (LOW) | csv.ts fallthrough to generic parser when no bank detected (expected) |
| D-106 | OPEN (LOW) | `apps/web/src/lib/parser/pdf.ts:260` bare `catch {}` |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C24-01 | MEDIUM | High | `apps/web/src/lib/parser/csv.ts` (all adapters) | Installment NaN guard logic duplicated across 10 bank adapters. Each adapter (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc) has an identical `if (Number.isNaN(inst)) { /* comment */ } else if (inst > 1)` block with the same C8-10 comment. If the installment parsing logic changes, all 10 copies must be updated. A shared `parseInstallments()` helper (similar to xlsx.ts's `parseInstallments()`) would eliminate the duplication. |
| C24-02 | MEDIUM | High | `apps/web/src/lib/store.svelte.ts:264` | `clearStorage()` has a bare `catch { /* SSR */ }` with no error logging. If sessionStorage removal fails for a non-SSR reason (e.g., SecurityError in a sandboxed iframe), the failure is silently swallowed with no diagnostic trail. Adding a `console.warn` for non-SSR failures would aid debugging. |
| C24-03 | LOW | High | `apps/web/src/components/dashboard/SpendingSummary.svelte:138` | When `monthDiff === 0` (e.g., two monthlyBreakdown entries for the same month), the template shows "0개월 전 실적" which is confusing. A `monthDiff === 0` guard showing "같은 달 실적" would be clearer. |
| C24-04 | LOW | Medium | `apps/web/src/lib/cards.ts:207-211` | When `loadCardsData()` chains a new caller's AbortSignal to an already-aborting shared controller, the `{ once: true }` listener on the dead controller is technically harmless but conceptually untidy. No functional bug. |
| C24-05 | LOW | Medium | `apps/web/src/lib/formatters.ts:190-194` | `buildPageUrl()` does not strip trailing slashes from the path. If called with `'dashboard/'`, the result would have a double-slash-like segment. All current call sites pass bare names, so this is an edge case. |
| C24-06 | LOW | High | `packages/core/src/optimizer/greedy.ts:224` | `buildCardResults` computes `totalSpending` as `reduce((sum, tx) => sum + tx.amount, 0)` without guarding against negative amounts internally. Safe in practice since the only caller passes pre-filtered transactions, but the function lacks its own invariant. |

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
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | MEDIUM | AI categorizer disabled but dead code in TransactionReview |
| C8-08 | LOW | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code |
| C18-01 | MEDIUM | VisibilityToggle $effect directly mutates DOM (cleanup improved but pattern fragile) |
| C18-02 | LOW | Results page stat elements queried on dashboard where they don't exist |
| C18-03 | LOW | Annual savings projection multiplies by 12 without seasonal adjustment |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | LOW | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | LOW | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C20-02 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04 | LOW | cachedCategoryLabels never invalidated (deferred) |
| C22-04 | LOW | CSV adapter gap for 14 banks (deferred) |
| C22-05 | LOW | TransactionReview O(n) changeCategory (deferred) |
| C23-02 | LOW | cachedCoreRules never invalidated (deferred, same class as C21-04) |
| C23-04 | LOW | csv.ts generic header detection heuristic (low risk) |
| C23-05 | LOW | csv.ts fallthrough to generic parser (expected behavior) |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03 | LOW | CardDetail performance tier header dark mode contrast |
| C14-03 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
