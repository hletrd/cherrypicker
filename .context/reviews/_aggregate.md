# Review Aggregate -- 2026-04-20 (Cycle 25)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle25-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-24 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-24 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile -- no change since cycle 7 |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | OPEN (MEDIUM) | AI categorizer disabled but ~40 lines of unreachable dead code stub |
| C8-05/C4-09 | OPEN (LOW→MEDIUM) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast (re-elevated: water/gas nearly invisible) |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C18-01 | OPEN (MEDIUM) | VisibilityToggle $effect directly mutates DOM; now uses cached refs with isConnected check (C21-01 fix) but pattern remains fragile |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements with isConnected check (C21 fix), but getElementById pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04 | OPEN (LOW) | cachedCategoryLabels never invalidated (deferred) |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C23-02 | OPEN (LOW) | `analyzer.ts:47` cachedCoreRules never invalidated -- same class as C21-04 |
| C23-04 | OPEN (LOW) | csv.ts generic header detection heuristic (low risk) |
| C23-05 | OPEN (LOW) | csv.ts fallthrough to generic parser when no bank detected (expected) |
| D-106 | OPEN (MEDIUM) | `apps/web/src/lib/parser/pdf.ts:260` bare `catch {}` |
| C24-01 | **FIXED** | csv.ts installment NaN guard duplicated across 10 adapters -- now uses shared `parseInstallments()` helper |
| C24-02 | **FIXED** | clearStorage() now logs non-SSR failures via console.warn |
| C24-03 | **FIXED** | monthDiff === 0 already handled by ternary showing "이전 실적" |
| C24-04 | OPEN (LOW) | cards.ts chainAbortSignal { once: true } on dead controller (harmless) |
| C24-05 | OPEN (LOW) | buildPageUrl() does not strip trailing slashes (edge case) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C25-01 | MEDIUM | High | `CategoryBreakdown.svelte:6-49` | CATEGORY_COLORS poor dark mode contrast: `water: '#1f2937'` and `gas: '#374151'` are nearly invisible on dark backgrounds (~1.1:1 and ~1.4:1 contrast). Upgraded from C8-05 which was previously LOW -- specific invisible colors warrant MEDIUM. |
| C25-02 | MEDIUM | High | `analyzer.ts:47` | cachedCoreRules never invalidated across sessions. Same class as C21-04/C23-02 (cachedCategoryLabels). Long-lived tabs won't pick up new card data. |
| C25-06 | MEDIUM | High | `pdf.ts:260` | Bare `catch {}` in tryStructuredParse swallows structured parse failures silently. Same as D-106, re-confirmed. |
| C25-09 | MEDIUM | Medium | `CardDetail.svelte:225-229` | Performance tier group header `text-blue-300` on `bg-[var(--color-primary-light)]` may have insufficient contrast in dark mode. Same class as C53-03. |
| C25-03 | LOW | High | `csv.ts:79-91` | DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts. Same as C20-02. |
| C25-04 | LOW | Medium | `greedy.ts:224` | buildCardResults totalSpending does not guard against negative amounts. Same as C24-06. |
| C25-08 | LOW | High | `build-stats.ts:16-18` | Fallback card stats values will drift. Same as C8-07/C4-14. |
| C25-10 | LOW | Medium | `pdf.ts:21-27` | Module-level regex constants divergence with date-utils.ts. Same as C20-04. |
| C25-11 | LOW | High | `TransactionReview.svelte:128` | changeCategory O(n) array copy on every category change. Same as C22-05. |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/C8-05/C25-01 | MEDIUM | Hardcoded CATEGORY_COLORS in CategoryBreakdown (dark mode contrast -- water/gas invisible) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C4-14/D-44/C8-07/C25-08 | LOW | Stale fallback values in Layout footer / build-stats |
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
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02 | LOW→MEDIUM | cachedCategoryLabels/cachedCoreRules never invalidated (deferred) |
| C22-04 | LOW | CSV adapter gap for 14 banks (deferred) |
| C22-05/C25-11 | LOW | TransactionReview O(n) changeCategory (deferred) |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03/C25-09 | MEDIUM | CardDetail performance tier header dark mode contrast |
| D-106/C25-06 | MEDIUM | pdf.ts bare catch {} in tryStructuredParse |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
