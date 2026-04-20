# Review Aggregate -- 2026-04-21 (Cycle 21)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle21-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-20 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-20 findings are confirmed fixed except as noted below:

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
| C8-10 | OPEN (LOW) | csv.ts installment NaN implicitly filtered by `> 1` comparison |
| C8-11 | OPEN (LOW) | pdf.ts fallback date regex could match decimal numbers like "3.5" |
| C18-01 | OPEN (MEDIUM) | VisibilityToggle $effect directly mutates DOM; cleanup now uses captured refs (C19-02 fix) but pattern remains fragile |
| C18-02 | OPEN (LOW) | Results page stat elements queried every effect run even on dashboard page |
| C18-03 | OPEN (LOW) | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment |
| C18-04 | OPEN (LOW) | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | OPEN (LOW) | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | OPEN (LOW) | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C20-01 | **FIXED** | `xlsx.ts:220` parseAmount string path now uses `Math.round(parseFloat(...))` |
| C20-02 | OPEN (LOW) | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-03 | **FIXED** | `store.svelte.ts:144` `isOptimizableTx` now uses `tx: unknown` |
| C20-04 | OPEN (LOW) | pdf.ts module-level regex constants not shared with date-utils.ts |
| C20-05 | **FIXED** | `formatters.ts:190-193` buildPageUrl now strips leading slashes defensively |
| D-106 | OPEN (LOW) | `apps/web/src/lib/parser/pdf.ts:243` bare `catch {}` |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C21-01 | MEDIUM | High | `VisibilityToggle.svelte:33-85` | The `$effect` captures DOM elements by ID on every run. When Astro navigates between pages client-side (View Transitions), the effect cleanup from the old page instance may reference stale DOM nodes that have been replaced by the new page. While C19-02 fixed the race by using captured refs, a more fundamental issue remains: the `$effect` runs on every store change, re-querying DOM by ID each time. If the store updates while navigating between pages, the effect could populate elements from the old page that are about to be torn down. A Svelte-friendly approach would use component-bound refs or bind:this instead of getElementById. |
| C21-02 | LOW | High | `cards.ts:151` | `cardsPromise` and `categoriesPromise` are module-level singletons. If two components call `loadCardsData()` nearly simultaneously with different AbortSignals, the second signal is chained via `chainAbortSignal` to the same in-flight controller. If the first component unmounts (aborting its signal), the shared controller is also aborted, cancelling the second component's fetch. The `cardsPromise` is then reset to null, allowing a retry, but there's a brief window where both consumers see an aborted result. |
| C21-03 | LOW | Medium | `csv.ts:33-42` | `parseAmount` in csv.ts uses `parseInt` which truncates decimal values (matching the original C20-01 concern for xlsx, now fixed there with Math.round). For CSV files, formula-rendered string amounts like "1,234.56" would become 1234 instead of 1235. While KRW doesn't have subunits, the inconsistency with the xlsx parser (which now uses Math.round) is a maintenance risk. |
| C21-04 | LOW | Medium | `store.svelte.ts:265-285` | `cachedCategoryLabels` is never invalidated when categories.json changes. Since categories.json is a static file served from the build, this is a theoretical concern, but the cache also survives across different analysis sessions within the same tab without reset. |
| C21-05 | LOW | High | `FileDropzone.svelte:48` | `fileInputEl` is bound to both file input elements (lines 329 and 348). When `clearAllFiles()` or `removeFile()` sets `fileInputEl.value = ''`, it only resets the last bound input. If the user clicked "파일 추가" to add files, the primary input would not be reset. |

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
| C8-10 | LOW | csv.ts installment NaN fragile implicit filter |
| C8-11 | LOW | pdf.ts fallback date regex could match decimals |
| C18-01 | MEDIUM | VisibilityToggle $effect directly mutates DOM (cleanup improved but pattern fragile) |
| C18-02 | LOW | Results page stat elements queried on dashboard where they don't exist |
| C18-03 | LOW | Annual savings projection multiplies by 12 without seasonal adjustment |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | LOW | FileDropzone navigation uses full page reload (deferred: requires ClientRouter) |
| C19-05 | LOW | CardDetail navigation uses full page reload (deferred: requires ClientRouter) |
| C20-02 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03 | LOW | CardDetail performance tier header dark mode contrast |
| C14-03 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
