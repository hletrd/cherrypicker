# Cycle 23 Comprehensive Code Review -- 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/`, `packages/parser/`, `packages/rules/`, `packages/viz/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern (line 75-83) -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` "거래 내역을 불러오지 못했어요" for corruption case; truncation case now shows count |
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` trimmed to ~40 lines of dead code stub. TransactionReview.svelte:6 now has single-line comment (improved from 8-line block). Dead code still present. |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values that drift |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Centralized but issue remains. |
| C8-09 | OPEN (LOW) | Test files still duplicate production code |
| C8-10 | **FIXED** | csv.ts installment NaN now has explicit check with comment |
| C8-11 | **FIXED** | pdf.ts fallback date regex now uses `isValidShortDate()` helper |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:65-125` $effect with DOM manipulation. Now has cached element refs with isConnected check. Pattern remains fragile but functional. |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:79-90` stat element queries guarded by `hasData && cachedDataEl` check -- improved |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection multiplies by 12. Qualifier text "단순 연환산" is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8 |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C20-02 | OPEN (LOW) | `csv.ts:67-74` DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts -- comments note the sync requirement |
| C20-04 | OPEN (LOW) | `pdf.ts:16-22` module-level regex constants not shared with date-utils.ts -- comments note the sync requirement |
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements and checks isConnected -- improved but pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race -- deferred |
| C21-03 | **FIXED** | csv.ts parseAmount now uses `Math.round(parseFloat(...))` |
| C21-04 | OPEN (LOW) | `store.svelte.ts:294` cachedCategoryLabels never invalidated -- deferred |
| C21-05 | **FIXED** | FileDropzone now uses separate primaryFileInputEl and addFileInputEl refs |
| C22-01 | **FIXED** | pdf.ts parseAmount now uses `Math.round(parseFloat(...))` (line 166-177) |
| C22-02 | **FIXED** | SavingsComparison.svelte:61-66 now checks `prefers-reduced-motion` and skips animation |
| C22-03 | **FIXED** | store.svelte.ts now tracks `truncatedTxCount` in PersistResult; SpendingSummary.svelte:152 shows count |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks -- deferred |
| C22-05 | OPEN (LOW) | TransactionReview.svelte:129 `editedTxs.map()` creates new array on every category change -- deferred |
| D-106 | OPEN (LOW) | `pdf.ts:260` `catch {}` -- bare catch, but returning null is intended fallback |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C23-01 | MEDIUM | High | `packages/core/src/optimizer/greedy.ts:265-267` | Greedy optimizer filters out transactions with `tx.amount > 0` on line 266 but does not filter out `NaN` amounts. If a transaction somehow has `amount: NaN` (e.g. from a parser bug that passes validation), `NaN > 0` is `false` so it would be filtered. However, the `b.amount - a.amount` sort on line 267 would produce `NaN` comparisons, which sort inconsistently across JS engines. While NaN amounts should be caught upstream, the optimizer has no defensive guard. Adding an explicit `Number.isFinite(tx.amount)` check would make the optimizer robust against upstream parser bugs. |
| C23-02 | LOW | High | `apps/web/src/lib/analyzer.ts:46-70` | `toCoreCardRuleSets()` caches only the full unfiltered list (`cachedCoreRules`) but the cache is never invalidated. If `getAllCardRules()` were to return different data (e.g. after a JSON fetch refresh), the stale cache would be used. Currently `cards.json` is static and never changes within a session, so this is safe. But the cache invalidation note at line 42-46 says "rules from static JSON don't change per session" which is an assumption that could break if the data source becomes dynamic. This is the same issue as C21-04 but for a different cache. |
| C23-03 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:131-138` | The monthly difference calculation uses `parseInt` on month slices. If `latestMonth.month` or `prevMonth.month` contains a non-numeric string (e.g., a corrupted value), `parseInt` returns `NaN`, and the `Number.isFinite` check on line 137 correctly handles this by setting `monthDiff` to `NaN`. The `monthDiff === 1` check on line 138 then falls through correctly. However, the fallback text `${monthDiff}개월 전 실적` would show "NaN개월 전 실적" to the user. A guard for `!Number.isFinite(monthDiff)` would prevent this display artifact. |
| C23-04 | LOW | Medium | `apps/web/src/lib/parser/csv.ts:100-108` | The generic CSV parser's header detection loop scans up to 20 lines looking for Korean text, but it only checks `hasNonNumeric` (presence of Korean/Latin characters). This means the FIRST row with any Korean text is assumed to be the header. If a CSV file has Korean merchant names in data rows before the actual header row (e.g., a file with a title line followed by a header), the title line would be selected as the header, causing incorrect column mapping. The bank-specific adapters avoid this by checking for specific header keywords. The generic parser's heuristic is less precise. |
| C23-05 | LOW | High | `apps/web/src/lib/parser/csv.ts:922-969` | The `parseCSV` function tries bank-specific adapters first, then falls back to content-signature detection, then to the generic parser. However, if a bank adapter's `detect()` method returns `true` but the adapter's `parseCSV()` throws an exception, the error is caught and the function continues to the next adapter. But if NO adapter's `detect()` returns true (and `resolvedBank` was not provided), the code falls through to `parseGenericCSV(content, null)` on line 963 with `resolvedBank === null`. The generic parser then has no bank-specific column knowledge. This is expected behavior but the bank detection step (lines 949-960) could miss banks that have unusual signatures not matching the detect() patterns. |

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML`, `v-html`, or `dangerouslySetInnerHTML` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: `Layout.astro` has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage, and cards.ts all properly clean up with AbortController and generation counters.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched. No eval/Function patterns.
7. **parseAmount consistency is now fixed**: All three parsers (csv.ts, xlsx.ts, pdf.ts) now use `Math.round(parseFloat(...))`.
8. **categorizer-ai.ts dead code remains**: 40-line stub still present but TransactionReview comment is now a single line (improved from C8-01).
9. **No `as any` casts in production code**: Only found in test files and the store's validation code where `parsed.optimization.cardResults.filter((cr: any) => ...)` is used for runtime validation of sessionStorage data.
10. **Type suppression only in tests**: `@ts-ignore` and `eslint-disable` only appear in test files (`analyzer-adapter.test.ts`, `schema.test.ts`), which is acceptable.

---

## Summary

- **5 new findings** this cycle (1 MEDIUM, 4 LOW)
- **3 prior findings confirmed fixed** since last review (C22-01, C22-02, C22-03)
- **All other prior open findings verified as still open** with accurate file/line references
