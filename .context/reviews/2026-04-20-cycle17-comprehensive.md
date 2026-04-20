# Cycle 17 Comprehensive Code Review — 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern — fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-10 | OPEN (LOW) | `CategoryBreakdown.svelte:88` uses `Math.round(pct * 10) / 10` — can still sum > 100% |
| C7-11 | OPEN (LOW) | `store.svelte.ts:152` message says "거래 내역을 불러오지 못했어요" for both corruption and truncation — still not differentiated |
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` still 40 lines of dead code (disabled AI categorizer). TransactionReview.svelte:6-13 still has 8 lines of re-enable comments |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-06/C7-12 | OPEN (LOW) | `CardDetail.svelte:276` and `FileDropzone.svelte:217` still use `window.location.href` for navigation |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `csv.ts:30`, `xlsx.ts:183`, `pdf.ts:137` — `inferYear()` still timezone-dependent near midnight Dec 31 |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (e.g., `parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C8-10 | OPEN (LOW) | `csv.ts:258` `inst > 1` implicitly filters NaN installment values |
| C8-11 | OPEN (LOW) | `pdf.ts:354` fallback date regex could match "3.5" as MM.DD |
| C9R-03/C16-01 | OPEN (LOW→MEDIUM) | `pdf.ts` now allows negative amounts, `store.svelte.ts:148` allows `tx.amount !== 0` — refund flow now works through both paths |
| C15-01 | **FIXED** | `cards.ts` no longer has `undefined as unknown as` — AbortError path uses proper type narrowing |
| D-106 | OPEN (LOW) | `pdf.ts:296` `catch {}` in `tryStructuredParse` — bare catch, but returning null is the intended fallback |
| C16-01 | **FIXED** | `store.svelte.ts:148` `isValidTx` now uses `tx.amount !== 0` instead of `tx.amount > 0` |
| C16-02 | **FIXED** | `csv.ts:246` now uses Korean error message |
| C16-03 | **FIXED** | `SpendingSummary.svelte:138` now shows actual month gap |
| C16-04 | **FIXED** | `CardGrid.svelte:73-78` now has AbortController cleanup |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C17-01 | MEDIUM | High | `pdf.ts:323` | `(item: any)` type annotation for pdfjs TextItem. The `any` bypasses type checking on the `item` object, which could mask future API changes in pdfjs-dist. Should use a proper interface or at minimum `Record<string, unknown>` with a narrowing check. This is the only `any` in runtime code outside of store validation. |
| C17-02 | LOW | High | `store.svelte.ts:248-250` | When `result !== null && result.transactions === undefined`, `persistWarningKind` defaults to `_loadPersistWarningKind ?? 'truncated'`. If `_loadPersistWarningKind` is null (e.g., transactions were never saved because the data was just computed, not restored from sessionStorage), this incorrectly sets the warning to 'truncated'. Only an actual load-from-storage should trigger the warning. |
| C17-03 | LOW | Medium | `FileDropzone.svelte:217` | `window.location.href = import.meta.env.BASE_URL + 'dashboard'` does not handle the case where `BASE_URL` already ends with `/`. If BASE_URL is `/app/`, this produces `/app/dashboard` (correct), but if it's `/app`, it produces `/appdashboard` (broken). Same issue in `CardDetail.svelte:276`. The `getBaseUrl()` in cards.ts handles this but these components don't use it. |
| C17-04 | LOW | High | `results.astro:80` | Inline `<script is:inline>` tag loads `/cherrypicker/scripts/results.js`, but the `id="results-data-content"` div and `id="results-empty-state"` div are toggled by this script — not by Svelte reactivity. This creates a split-brain: Svelte components inside (SavingsComparison, OptimalCardMap) read from the store, but the container visibility is managed by a plain JS script. If the store has data but the script hasn't run (or fails), content stays hidden. Same pattern in `dashboard.astro:121`. |
| C17-05 | LOW | Medium | `CategoryBreakdown.svelte:88-89` | The `< 2` threshold for the "other" group uses `pct` which is `Math.round((a.spending / totalSpending) * 1000) / 10`. This means 1.95% rounds to 2.0 and stays visible, but 1.94% rounds to 1.9 and gets grouped into "other". The threshold is applied after rounding, which creates an asymmetric boundary. Not a bug per se, but could surprise users who expect consistent grouping. |

---

## Final Sweep — Commonly Missed Issues

1. **No XSS risk**: All dynamic content is rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` or `v-html` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code. The Claude API key reference in CLAUDE.md is for a development tool, not hardcoded.
3. **CSP is properly configured**: `Layout.astro:42` has appropriate CSP headers.
4. **AbortController patterns are now consistent**: CardGrid, CardDetail, CardPage all properly clean up.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **The `inferYear` function is duplicated across 3 files** (csv.ts, xlsx.ts, pdf.ts) — this is a maintainability concern already noted in C8-09 (test duplication) but the production code duplication is arguably more impactful.

---

## Summary

- **4 new findings** this cycle (1 MEDIUM, 3 LOW)
- **1 prior finding confirmed fixed** (C15-01)
- **3 prior findings confirmed fixed from C16** (C16-01, C16-02, C16-03, C16-04)
- **All other prior open findings verified as still open** with accurate file/line references
