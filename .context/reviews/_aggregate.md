# Review Aggregate -- 2026-04-22 (Cycle 22)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-22-cycle22-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-21 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-21 findings are confirmed fixed except as noted below:

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
| D-106 | OPEN (LOW) | `apps/web/src/lib/parser/pdf.ts:243` bare `catch {}` |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C22-01 | MEDIUM | High | `pdf.ts:166-172` | `parseAmount` in pdf.ts uses `parseInt` which is inconsistent with the csv.ts (C21-03 fix) and xlsx.ts (C20-01 fix) parsers, which now both use `Math.round(parseFloat(...))`. For a string like "1,234.56", pdf.ts would produce 1234 while csv.ts would produce 1235. Same class of inconsistency as C21-03 but in a different parser. |
| C22-02 | LOW | High | `SavingsComparison.svelte:53-71` | The count-up animation `$effect` uses `requestAnimationFrame` without checking for `prefers-reduced-motion`. Users with reduced motion preferences will still see the animation. WCAG 2.2 criterion 2.3.3. |
| C22-03 | LOW | High | `store.svelte.ts:107-137` | `persistToStorage` truncates transactions when over 4MB but does not record how many transactions were omitted. The truncation warning gives no indication of data loss magnitude. |
| C22-04 | LOW | Medium | `detect.ts:8-105` vs `csv.ts:209-903` | BANK_SIGNATURES has 24 bank entries but CSV adapter registry only handles 10 banks. 14 banks (kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost) fall through to `parseGenericCSV()` with no bank-specific header detection. XLSX parser has column configs for all 24 banks. Asymmetry means CSV files from unsupported banks are less reliably parsed. |
| C22-05 | LOW | Medium | `TransactionReview.svelte:130` | `changeCategory` uses `editedTxs = editedTxs.map(...)` which creates a new array on every category change. O(n) per change. Could use indexed update for O(1) but not a practical problem for typical statement sizes. |

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
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03 | LOW | CardDetail performance tier header dark mode contrast |
| C14-03 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
