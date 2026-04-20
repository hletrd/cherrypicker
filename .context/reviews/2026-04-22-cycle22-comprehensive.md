# Cycle 22 Comprehensive Code Review -- 2026-04-22

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
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` is trimmed to ~40 lines of dead code (disabled AI categorizer stub). TransactionReview.svelte:6-13 still has 8 lines of re-enable comments |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is now centralized but timezone issue remains |
| C8-09 | OPEN (LOW) | Test files still duplicate production code |
| C8-10 | OPEN (LOW) | `csv.ts:181` `inst > 1` -- now has explicit NaN check with comment (C21 cycle fix), no longer relying on implicit NaN filter |
| C8-11 | OPEN (LOW) | `pdf.ts:301` fallback date regex -- now has `isValidShortDate()` helper (C21 cycle fix) |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Now has cached element refs with isConnected check (C21-01 fix). Pattern remains fragile. |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:207` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8. EUC-KR files would not be detected. BOM is stripped. |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:217` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C20-02 | OPEN (LOW) | `csv.ts:60-72` DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04 | OPEN (LOW) | `pdf.ts:16-22` module-level regex constants not shared with date-utils.ts |
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements and checks isConnected (C21 fix), but pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race -- deferred |
| C21-03 | FIXED | csv.ts parseAmount now uses `Math.round(parseFloat(...))` to match xlsx parser |
| C21-04 | OPEN (LOW) | cachedCategoryLabels never invalidated -- deferred |
| C21-05 | FIXED | FileDropzone now uses separate primaryFileInputEl and addFileInputEl refs |
| D-106 | OPEN (LOW) | `pdf.ts:255` `catch {}` -- bare catch, but returning null is intended fallback |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C22-01 | MEDIUM | High | `pdf.ts:166-172` | `parseAmount` in pdf.ts uses `parseInt` (not `Math.round(parseFloat(...))`) which is inconsistent with the csv.ts (C21-03 fix) and xlsx.ts (C20-01 fix) parsers. While KRW doesn't have subunits, the inconsistency across the three parsers is a maintenance risk. The csv.ts and xlsx.ts parsers now both use `Math.round(parseFloat(...))` but pdf.ts still uses `parseInt`. For a string like "1,234.56", pdf.ts would produce 1234 while csv.ts would produce 1235. |
| C22-02 | LOW | High | `SavingsComparison.svelte:53-71` | The count-up animation `$effect` uses `requestAnimationFrame` without checking for `prefers-reduced-motion`. Users who have enabled reduced motion in their OS settings will still see the animation. This is an accessibility concern (WCAG 2.2 criterion 2.3.3). The fix is to check `window.matchMedia('(prefers-reduced-motion: reduce)')` and skip the animation if it matches. |
| C22-03 | LOW | High | `store.svelte.ts:107-137` | `persistToStorage` truncates transactions when over 4MB but does not record how many transactions were omitted. When the user sees the "데이터가 커서 거래 내역이 저장되지 않았어요" warning, they have no indication of how many transactions were lost. Adding a count (e.g., `truncatedTxCount`) to the warning would improve user experience and help debugging. |
| C22-04 | LOW | Medium | `detect.ts:8-105` vs `csv.ts:209-903` | BANK_SIGNATURES in `detect.ts` has 24 bank entries but the CSV adapter registry (`csv.ts:909-920`) only handles 10 banks. Banks like kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost are detected by `detectBank()` but have no dedicated CSV adapter. They fall through to `parseGenericCSV()`, which may work for simple formats but has no bank-specific header detection for these banks. The XLSX parser (`xlsx.ts:18-170`) has column configs for all 24 banks. This asymmetry means CSV files from the 14 unsupported banks are less reliably parsed than their XLSX equivalents. |
| C22-05 | LOW | Medium | `TransactionReview.svelte:130` | `changeCategory` uses `editedTxs = editedTxs.map(...)` which creates a new array on every category change. For large transaction lists (1000+ entries), this is O(n) per change. While not a practical problem for typical statement sizes (50-200 transactions), it could cause jank with very large statements. Using an indexed update (splice or direct assignment with spread) would be O(1). |

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` or `v-html` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: `Layout.astro:42` has appropriate CSP headers with documented rationale for `unsafe-inline`.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched. No eval/Function patterns.
7. **parseAmount consistency gap confirmed**: pdf.ts still uses `parseInt` while csv.ts and xlsx.ts now use `Math.round(parseFloat(...))`.
8. **categorizer-ai.ts dead code remains**: 40-line stub still present with no callers that actually use it beyond the commented-out import in TransactionReview.svelte.

---

## Summary

- **5 new findings** this cycle (1 MEDIUM, 4 LOW)
- **2 prior findings confirmed fixed** since last review (C21-03, C21-05)
- **All other prior open findings verified as still open** with accurate file/line references
