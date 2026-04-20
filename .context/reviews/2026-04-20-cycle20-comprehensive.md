# Cycle 20 Comprehensive Code Review -- 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, verification of all prior open findings, targeted pattern search for new issues.

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
| C8-10 | OPEN (LOW) | `csv.ts:177` `inst > 1` implicitly filters NaN installment values |
| C8-11 | OPEN (LOW) | `pdf.ts:296` fallback date regex could match "3.5" as MM.DD |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Cleanup now uses captured element refs (C19-02 fix). Pattern remains fragile. |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:207` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:238-247` `isHTMLContent()` still only checks first 512 bytes as UTF-8. EUC-KR files would not be detected. BOM is stripped. |
| C19-01 | **FIXED** | `parseDateStringToISO` now centralized in `date-utils.ts`. All three parsers import from it. |
| C19-02 | **FIXED** | VisibilityToggle cleanup now uses captured element references instead of re-querying by ID |
| C19-03 | **FIXED** | CardPage `goBack()` now uses `window.location.hash = ''` instead of `replaceState` |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:217` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C19-06 | **FIXED** | `AMOUNT_PATTERNS[1]` now uses `/^-?[\d,]+원?$/` without the decimal-matching `\.?\d*` |
| C19-07 | **FIXED** | `isValidTx` renamed to `isOptimizableTx` with JSDoc explaining zero-amount exclusion |
| C9R-03/C16-01 | OPEN (LOW, path works) | pdf.ts negative amounts now pass through; store allows !== 0. Both ends fixed. |
| D-106 | OPEN (LOW) | `pdf.ts:238` `catch {}` in `tryStructuredParse` -- bare catch, but returning null is the intended fallback |
| D-110 | OPEN (LOW) | Non-latest month edits have no visible optimization effect |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C20-01 | MEDIUM | High | `xlsx.ts:206-221` | `parseAmount` for string input uses `parseInt` which truncates decimal values without warning, while numeric input uses `Math.round`. For Korean Won this is irrelevant, but the inconsistency means a value like "1,234.56" from a formula cell rendered as a string would silently become 1234 instead of 1235. The XLSX numeric path correctly rounds (line 210), but the string path does not (line 218). This is an inconsistency with the numeric path's `Math.round` approach. |
| C20-02 | LOW | High | `csv.ts:60-72` | `DATE_PATTERNS` and `AMOUNT_PATTERNS` arrays are module-level constants that are recreated for each module load. The `isDateLike` and `isAmountLike` helper functions are only used in the generic CSV parser's column auto-detection fallback. These patterns are not shared with `parseDateStringToISO` or `parseAmount`, creating a divergence risk -- adding a new date format to `parseDateStringToISO` in `date-utils.ts` does not update `DATE_PATTERNS` in csv.ts. |
| C20-03 | LOW | Medium | `store.svelte.ts:144` | `isOptimizableTx` uses `tx: any` parameter type instead of `unknown`. While the type guard (`tx is CategorizedTx`) narrows correctly, the `any` parameter bypasses TypeScript's excess property checking and allows any value to be passed without a type error. Using `unknown` would be safer and require explicit narrowing before property access. |
| C20-04 | LOW | High | `pdf.ts:16-22` | Module-level regex constants (`DATE_PATTERN`, `AMOUNT_PATTERN`, etc.) are defined in the PDF parser but are not used by the shared `parseDateStringToISO` in `date-utils.ts`. They are used for table parsing / fallback detection only. If a new date format is added to `parseDateStringToISO`, the PDF module-level patterns would need separate updating, creating a divergence risk similar to C20-02. |
| C20-05 | LOW | Medium | `formatters.ts:188-191` | `buildPageUrl` concatenates `base` + `/` + `path`, but if `path` starts with `/` (e.g., `buildPageUrl('/dashboard')`), the result would be `//dashboard` (double slash). The current callers always pass bare names like `'dashboard'` or `'cards'`, so this works correctly in practice, but the function does not document this constraint and does not guard against leading slashes. |

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` or `v-html` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: `Layout.astro:42` has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **`inferYear` consolidation (C18-05) verified**: All three parsers import from `./date-utils.js`.
7. **`parseDateStringToISO` consolidation (C19-01) verified**: All three parsers delegate to the shared implementation.
8. **VisibilityToggle cleanup race (C19-02) verified fixed**: Cleanup uses captured element references instead of re-querying by ID.
9. **`isOptimizableTx` rename (C19-07) verified**: Function renamed from `isValidTx` with JSDoc explaining the zero-amount exclusion.
10. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched. No eval/Function patterns.

---

## Summary

- **5 new findings** this cycle (1 MEDIUM, 4 LOW)
- **4 prior findings confirmed fixed** (C19-01, C19-02, C19-03, C19-06, C19-07)
- **All other prior open findings verified as still open** with accurate file/line references
