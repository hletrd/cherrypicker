# Cycle 21 Comprehensive Code Review -- 2026-04-21

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/`, `packages/parser/`, `packages/rules/`, `packages/viz/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:152` message says "거래 내역을 불러오지 못했어요" for both corruption and truncation |
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` is now trimmed to ~40 lines of dead code (disabled AI categorizer stub). TransactionReview.svelte:6-13 still has 8 lines of re-enable comments |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is now centralized (C18-05 FIXED) but timezone issue remains. |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (e.g., `parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C8-10 | OPEN (LOW) | `csv.ts:181` `inst > 1` implicitly filters NaN installment values |
| C8-11 | OPEN (LOW) | `pdf.ts:301` fallback date regex could match "3.5" as MM.DD |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Cleanup now uses captured element refs (C19-02 fix). Pattern remains fragile. |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:207` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8. EUC-KR files would not be detected. BOM is stripped. |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:217` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C20-01 | OPEN (MEDIUM) | `xlsx.ts:220` parseAmount string path now uses `Math.round(parseFloat(...))` -- C20-01 was fixed since cycle 20 |
| C20-02 | OPEN (LOW) | `csv.ts:60-72` DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-03 | OPEN (LOW) | `store.svelte.ts:144` `isOptimizableTx` uses `tx: unknown` -- was already changed from `any` since cycle 20 |
| C20-04 | OPEN (LOW) | `pdf.ts:16-22` module-level regex constants not shared with date-utils.ts |
| C20-05 | OPEN (LOW) | `formatters.ts:190-193` buildPageUrl now strips leading slashes defensively -- C20-05 was fixed since cycle 20 |
| D-106 | OPEN (LOW) | `pdf.ts:243` `catch {}` in `tryStructuredParse` -- bare catch, but returning null is the intended fallback |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C21-01 | MEDIUM | High | `VisibilityToggle.svelte:33-85` | The `$effect` captures DOM elements by ID on every run. When Astro navigates between pages client-side (View Transitions), the effect cleanup from the old page instance may reference stale DOM nodes that have been replaced by the new page. While C19-02 fixed the race by using captured refs, a more fundamental issue remains: the `$effect` runs on every store change, re-querying DOM by ID each time. If the store updates while navigating between pages, the effect could populate elements from the old page that are about to be torn down. A Svelte-friendly approach would use component-bound refs or bind:this instead of getElementById. |
| C21-02 | LOW | High | `cards.ts:151` | `cardsPromise` and `categoriesPromise` are module-level singletons. If two components call `loadCardsData()` nearly simultaneously with different AbortSignals, the second signal is chained via `chainAbortSignal` to the same in-flight controller. If the first component unmounts (aborting its signal), the shared controller is also aborted, cancelling the second component's fetch. The `cardsPromise` is then reset to null, allowing a retry, but there's a brief window where both consumers see an aborted result. |
| C21-03 | LOW | Medium | `csv.ts:33-42` | `parseAmount` in csv.ts uses `parseInt` which truncates decimal values (matching the original C20-01 concern for xlsx, now fixed there with Math.round). For CSV files, formula-rendered string amounts like "1,234.56" would become 1234 instead of 1235. While KRW doesn't have subunits, the inconsistency with the xlsx parser (which now uses Math.round) is a maintenance risk. |
| C21-04 | LOW | Medium | `store.svelte.ts:265-285` | `cachedCategoryLabels` is never invalidated when categories.json changes (e.g., during a long-lived session where the data is updated on the server). Since categories.json is a static file served from the build, this is a theoretical concern, but the cache also survives `reset()` calls -- after reset, the cache is cleared (line 444), but if a user navigates back to the dashboard without reset, stale labels could persist across different analysis sessions. |
| C21-05 | LOW | High | `FileDropzone.svelte:48` | `fileInputEl` is bound to both file input elements (line 329 and line 348). When `clearAllFiles()` or `removeFile()` sets `fileInputEl.value = ''`, it only resets the last bound input. If the user clicked "파일 추가" (line 329) to add files, the primary input (line 348) would not be reset. This is cosmetically minor since file inputs are recreated on re-render, but could cause stale file references in edge cases. |

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` or `v-html` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: `Layout.astro:42` has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **`inferYear` consolidation (C18-05) verified**: All three parsers import from `./date-utils.js`.
7. **`parseDateStringToISO` consolidation (C19-01) verified**: All three parsers delegate to the shared implementation.
8. **`isOptimizableTx` uses `unknown` (C20-03) verified**: Parameter type changed from `any` to `unknown`.
9. **xlsx `parseAmount` uses `Math.round` (C20-01) verified**: String path now matches numeric path's rounding behavior.
10. **`buildPageUrl` strips leading slashes (C20-05) verified**: Defensive guard added for leading-slash inputs.
11. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched. No eval/Function patterns.

---

## Summary

- **5 new findings** this cycle (1 MEDIUM, 4 LOW)
- **3 prior findings confirmed fixed since last review** (C20-01, C20-03, C20-05)
- **All other prior open findings verified as still open** with accurate file/line references
