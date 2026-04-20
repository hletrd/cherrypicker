# Cycle 18 Comprehensive Code Review — 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern — fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-10 | **FIXED** | `CategoryBreakdown.svelte:88-89` now uses `rawPct < 2` for threshold decision (raw unrounded value) while displaying rounded `pct`. C17-05 fix applied. |
| C7-11 | OPEN (LOW) | `store.svelte.ts:152` message says "거래 내역을 불러오지 못했어요" for both corruption and truncation — still not differentiated |
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` still 40 lines of dead code (disabled AI categorizer). TransactionReview.svelte:6-13 still has 8 lines of re-enable comments |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-06/C7-12 | **FIXED** | `FileDropzone.svelte:217` and `CardDetail.svelte:276` now use `buildPageUrl()` from `formatters.ts` |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in csv.ts:29, xlsx.ts:183, pdf.ts:144 — timezone-dependent near midnight Dec 31. Same code triplicated. |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (e.g., `parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C8-10 | OPEN (LOW) | `csv.ts:258` `inst > 1` implicitly filters NaN installment values |
| C8-11 | OPEN (LOW) | `pdf.ts:354` fallback date regex could match "3.5" as MM.DD |
| C17-01 | **FIXED** | `pdf.ts:9-10` now has proper `PdfTextItem` and `PdfTextMarkedContent` type aliases instead of `(item: any)` |
| C17-02 | **FIXED** | `store.svelte.ts:250-254` `persistWarningKind` now only set when `_loadPersistWarningKind !== null` — freshly computed data no longer triggers spurious warning |
| C17-03 | **FIXED** | `FileDropzone.svelte:217` and `CardDetail.svelte:276` now use `buildPageUrl()` |
| C17-04 | **FIXED** | `dashboard.astro:122` and `results.astro:81` now use `VisibilityToggle` Svelte component instead of inline `<script is:inline>` — split-brain eliminated |
| C17-05 | **FIXED** | `CategoryBreakdown.svelte:88-89` now uses `rawPct < 2` for threshold, displays rounded `pct` |
| C9R-03/C16-01 | OPEN (LOW→MEDIUM, path works) | pdf.ts negative amounts now pass through; store allows !== 0. Both ends fixed. |
| D-106 | OPEN (LOW) | `pdf.ts:303` `catch {}` in `tryStructuredParse` — bare catch, but returning null is the intended fallback |
| D-110 | OPEN (LOW) | Non-latest month edits have no visible optimization effect |
| D-66 | OPEN (LOW) | CardGrid issuer filter shows issuers with 0 cards after type filter |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C18-01 | MEDIUM | High | `VisibilityToggle.svelte:22-51` | `$effect` directly mutates DOM elements (`document.getElementById`, `classList.toggle`, `textContent = ...`). This is an anti-pattern in Svelte 5 because `$effect` runs are not guaranteed to be ordered relative to the DOM update, and the effect does not clean up — if the store is reset (data cleared), the visibility state from a previous run persists because there's no cleanup. Additionally, `textContent` assignment on elements outside Svelte's control can cause hydration mismatches. The effect also runs on every store change, not just when `optimization` changes, since it reads `analysisStore.result?.optimization` without a precise dependency. |
| C18-02 | LOW | High | `VisibilityToggle.svelte:36-49` | `document.getElementById('stat-total-spending')` etc. are queried every time the effect runs. If the results page is not mounted (user is on dashboard), these elements won't exist — the null checks (`if (totalSpending)`) handle this, but the effect still runs on every store change regardless of which page is active. This is wasted computation on the dashboard page. |
| C18-03 | LOW | Medium | `SavingsComparison.svelte:207` | Annual savings projection text says "연간 약 ... 절약 (최근 월 기준)" but multiplies only by 12. This is a simple monthly-to-annual extrapolation that doesn't account for seasonal spending variations or whether the analyzed month is representative. The text is technically correct ("최근 월 기준" qualifier is present) but could mislead users who expect a more nuanced projection. |
| C18-04 | LOW | High | `xlsx.ts:314-317` | `isHTMLContent()` only decodes the first 512 bytes as UTF-8. If the HTML file starts with a BOM (UTF-8 BOM: 0xEF 0xBB 0xBF), the first 3 bytes are the BOM, reducing effective detection range to 509 bytes. More critically, if the file uses a different encoding (e.g., EUC-KR common in Korean legacy systems), the UTF-8 decode could produce garbled text that doesn't match `<!doctype` or `<html` even though it's valid HTML. The existing comment in the code acknowledges this limitation partially but the BOM edge case is unhandled. |
| C18-05 | LOW | High | `inferYear()` triplicated | The `inferYear()` function is identically implemented in `csv.ts:29-37`, `xlsx.ts:183-190`, and `pdf.ts:144-151`. All three implementations have the same timezone-dependent logic (using `new Date()` for "now"). This is not a new finding (C8-08 covers timezone), but the triplication itself is a separate maintainability concern — any fix to `inferYear` must be applied in three places. A shared utility would reduce this to one. |

---

## Final Sweep — Commonly Missed Issues

1. **No XSS risk**: All dynamic content is rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` or `v-html` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code. The Claude API key reference in CLAUDE.md is for a development tool, not hardcoded.
3. **CSP is properly configured**: `Layout.astro:42` has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **The C17 fixes are all verified as correctly applied**: PdfTextItem type, persistWarningKind guard, buildPageUrl usage, VisibilityToggle component, rawPct threshold.
7. **VisibilityToggle has a design tension**: It bridges Astro-rendered static HTML with Svelte reactivity via direct DOM manipulation. This works but is fragile — if the element IDs change in the Astro template, the Svelte component silently breaks (no compile-time check). This is a known tradeoff of the current architecture.

---

## Summary

- **5 new findings** this cycle (1 MEDIUM, 4 LOW)
- **5 prior findings confirmed fixed** (C17-01, C17-02, C17-03, C17-04, C17-05, C7-10)
- **All other prior open findings verified as still open** with accurate file/line references
