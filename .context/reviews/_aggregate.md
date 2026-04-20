# Review Aggregate -- 2026-04-20 (Cycle 18)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-20-cycle18-comprehensive.md` (full re-read of all source files, re-verified all prior findings)

**Prior cycle reviews (still relevant):**
- All cycle 1-17 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-17 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:263` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:180` uses `formatRatePrecise()` |
| C7-04 | OPEN (LOW) | TransactionReview $effect re-sync fragile — no change since cycle 7 |
| C7-06 | OPEN (LOW) | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | OPEN (LOW) | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C7-09 | **FIXED** | `formatDateKo`/`formatDateShort` now have `Number.isNaN` guards |
| C7-10 | **FIXED** | `CategoryBreakdown.svelte:88-89` now uses `rawPct < 2` for threshold (C17-05 fix) |
| C7-11 | OPEN (LOW) | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | OPEN (MEDIUM) | AI categorizer disabled but 65+ lines of unreachable dead code |
| C8-02/C9R-02 | **FIXED** | `CardDetail.svelte:82-95` has AbortController cleanup via `$effect` return |
| C8-03 | **FIXED** | `SpendingSummary.svelte:123` now uses year-aware month diff |
| C8-05/C4-09 | OPEN (LOW) | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast (extends C4-09) |
| C8-06/C7-12 | **FIXED** | `FileDropzone.svelte:217` and `CardDetail.svelte:276` now use `buildPageUrl()` |
| C8-07/C4-14 | OPEN (LOW) | build-stats.ts fallback values will drift (extends C4-14) |
| C8-08 | OPEN (LOW) | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test duplicates production code instead of testing it directly |
| C8-10 | OPEN (LOW) | csv.ts installment NaN implicitly filtered by `> 1` comparison |
| C8-11 | OPEN (LOW) | pdf.ts fallback date regex could match decimal numbers like "3.5" |
| C8-12 | **FIXED** | `persistToStorage` now returns `PersistWarningKind` directly |
| C9-01 | **FIXED** | `analyzer.ts` cache uses null check, `cachedRulesRef` removed |
| C9-03 | **FIXED** | `detect.ts` tie-breaking documented |
| C9-05 | **FIXED** | `store.svelte.ts` error set when result is null in reoptimize |
| C9-11 | **FIXED** | `store.svelte.ts` `isValidTx` has non-empty checks for id, date, category |
| C9-13 | **FIXED** | `analyzer.ts` monthlyBreakdown explicitly sorted by month |
| C10-01 | **FIXED** | `SpendingSummary.svelte:10-18` has try/catch around sessionStorage reads |
| C10-03 | **FIXED** | PDF parseAmount reports errors in both structured and fallback paths |
| C11-01 | **FIXED** | `analyzer.ts:304` now uses `Math.abs(tx.amount)` |
| C11-03 | **FIXED** | `pdf.ts:382-389` now reports errors for unparseable amounts |
| C12-01 | **FIXED** | `OptimalCardMap.svelte:19-25` maxRate floor lowered from 0.5% to 0.1% |
| C12-04 | **FIXED** | `SavingsComparison.svelte:205` removed redundant `Object.is(-0)` guard |
| C13-01 | **FIXED** | `cards.ts:160-167` now has `chainAbortSignal` |
| C13-02 | **FIXED** | `cards.ts:199-226` `loadCategories` now accepts optional `signal` parameter |
| C13-03 | **FIXED** | `SpendingSummary.svelte:12-15` now uses `$derived` for `totalAllSpending` |
| C13-04 | **FIXED** | `CardPage.svelte:14-30` now has AbortController + generation counter pattern |
| C14-01 | **FIXED** | `cards.ts` catch blocks use `isAbortError` to distinguish AbortError |
| C15-01 | **FIXED** | `cards.ts` no longer has `undefined as unknown as` type escapes |
| C16-01 | **FIXED** | `store.svelte.ts:148` `isValidTx` now uses `tx.amount !== 0` allowing refunds |
| C16-02 | **FIXED** | `csv.ts:246` now uses Korean error message |
| C16-03 | **FIXED** | `SpendingSummary.svelte:138` now shows actual month gap |
| C16-04 | **FIXED** | `CardGrid.svelte:73-78` now has AbortController cleanup |
| C17-01 | **FIXED** | `pdf.ts:9-10` now has proper `PdfTextItem`/`PdfTextMarkedContent` types |
| C17-02 | **FIXED** | `store.svelte.ts:250-254` persistWarningKind guard for freshly computed data |
| C17-03 | **FIXED** | `FileDropzone.svelte:217` and `CardDetail.svelte:276` now use `buildPageUrl()` |
| C17-04 | **FIXED** | `dashboard.astro:122` and `results.astro:81` use VisibilityToggle Svelte component |
| C17-05 | **FIXED** | `CategoryBreakdown.svelte:88-89` uses `rawPct < 2` for threshold |
| C52-02 | **FIXED** | `TransactionReview.svelte:108-130` uses `updatedTxs.map()` replacement pattern |
| C53-01 | **FIXED** | `TransactionReview.svelte:120-139` `changeCategory` uses replacement pattern |
| C9R-03/C16-01 | OPEN (LOW→MEDIUM, now FIXED path works) | pdf.ts negative amounts now pass through; store allows !== 0. Both ends fixed. |
| D-106 | OPEN (LOW) | `apps/web/src/lib/parser/pdf.ts:303` bare `catch {}` |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C18-01 | MEDIUM | High | `VisibilityToggle.svelte:22-51` | `$effect` directly mutates DOM elements via `document.getElementById` + `classList.toggle` + `textContent = ...`. Anti-pattern in Svelte 5: no cleanup on store reset (elements stay visible), no compile-time check on element IDs, and runs on every store change regardless of which page is mounted. |
| C18-02 | LOW | High | `VisibilityToggle.svelte:36-49` | Results page stat elements (`stat-total-spending` etc.) queried every effect run even on dashboard page where they don't exist — wasted DOM queries. |
| C18-03 | LOW | Medium | `SavingsComparison.svelte:207` | Annual savings projection simply multiplies monthly by 12 without seasonal adjustment. Qualifier text is present but projection could mislead. |
| C18-04 | LOW | High | `xlsx.ts:314-317` | `isHTMLContent()` only decodes first 512 bytes as UTF-8. UTF-8 BOM consumes 3 bytes; EUC-KR encoded files would not be detected as HTML. |
| C18-05 | LOW | High | `inferYear()` triplicated | Identical `inferYear()` in csv.ts, xlsx.ts, pdf.ts — any fix must be applied three times. |

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
| C7-12/C8-06 | LOW | CardDetail + FileDropzone use full page reload — **FIXED** via buildPageUrl |
| C7-13 | LOW | toCoreCardRuleSets cache keyed by reference equality (now uses null check, improved) |
| C8-01 | MEDIUM | AI categorizer disabled but dead code in TransactionReview |
| C8-08 | LOW | inferYear() timezone edge case near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code |
| C8-10 | LOW | csv.ts installment NaN fragile implicit filter |
| C8-11 | LOW | pdf.ts fallback date regex could match decimals |
| C11-02 | LOW | BASE_URL trailing slash assumption — **FIXED** via buildPageUrl |
| C53-02 | LOW | Duplicated card stats reading logic in index.astro and Layout.astro |
| C53-03 | LOW | CardDetail performance tier header dark mode contrast |
| C14-03 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| D-01 through D-111 | Various | See deferred items file for full list |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
