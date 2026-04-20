# Cycle 26 Comprehensive Code Review -- 2026-04-21

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:152` message says "거래 내역을 불러오지 못했어요" for both corruption and truncation |
| C8-01 | **FIXED** | `categorizer-ai.ts` has been removed entirely. TransactionReview.svelte no longer imports it. Dead code eliminated. |
| C8-05/C4-09 | OPEN (LOW→MEDIUM) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on water/gas/electricity entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is now centralized but timezone issue remains |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (`parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Has cached element refs with isConnected check but pattern remains fragile |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8 |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C20-02 | OPEN (LOW) | `csv.ts:79-91` DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04 | OPEN (LOW) | `pdf.ts:21-27` module-level regex constants not shared with date-utils.ts |
| C21-01 | OPEN (MEDIUM) | VisibilityToggle $effect caches elements and checks isConnected, but getElementById pattern remains fragile |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04 | OPEN (LOW→MEDIUM) | cachedCategoryLabels never invalidated -- same class as C23-02/C25-02 |
| C22-02 | OPEN (LOW) | SavingsComparison count-up animation now respects prefers-reduced-motion (JS-level check added). However, the global CSS rule in app.css already forces 0.01ms durations, making the JS check redundant but not harmful. Both layers are consistent. **Downgraded to no-action** -- already handled. |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C23-02 | OPEN (LOW→MEDIUM) | `analyzer.ts:47` cachedCoreRules never invalidated -- same class as C21-04 |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C25-01 | OPEN (MEDIUM) | CATEGORY_COLORS poor dark mode contrast (water, gas, electricity) |
| C25-02 | OPEN (MEDIUM) | cachedCoreRules never invalidated across sessions |
| C25-06 | OPEN (MEDIUM) | pdf.ts bare catch in tryStructuredParse -- **NOW FIXED**: line 264 now logs `console.warn('[cherrypicker] Structured PDF table parse failed, falling back to line scan:', ...)` |
| C25-09 | OPEN (MEDIUM) | CardDetail performance tier header dark mode contrast |

---

## Newly Fixed Findings

| Finding | Status | Evidence |
|---|---|---|
| C8-01 | **FIXED** | `categorizer-ai.ts` removed entirely. No import in TransactionReview.svelte. Dead code eliminated. |
| C25-06/D-106 | **FIXED** | `pdf.ts:264` now has `console.warn` inside the catch block for structured parse failure. |
| C22-02 | **FIXED** | SavingsComparison count-up animation respects `prefers-reduced-motion` via JS check at line 62. Global CSS also handles it. |

---

## New Findings (This Cycle)

### C26-01 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:147`

**Inline `catch {}` in template event handler**

The dismiss button has `try { sessionStorage.setItem(...) } catch {}` inline in the template. This is a bare catch with no logging. While this is non-critical (the sessionStorage write is best-effort, and failure only means the dismissal doesn't persist), it's inconsistent with the C24-02 fix that added `console.warn` for non-SSR sessionStorage failures in `clearStorage()`. For consistency, this should log the failure.

**Fix:** Replace `catch {}` with `catch { /* non-critical: dismissal just won't persist */ }` or add a minimal `console.warn`.

### C26-02 | LOW | High | `apps/web/src/lib/parser/csv.ts:101-210`

**parseGenericCSV skips zero-amount rows silently**

In `parseGenericCSV` (line 183-186), when `amount` is `NaN`, the row is skipped with an error. But when `amount` is `0`, the transaction is still added to the results (line 188-207). Zero-amount rows are typically balance inquiries or declined transactions that shouldn't appear in optimization results. The bank-specific adapters also don't filter zero amounts, but the PDF parser (`pdf.ts:231-237`) explicitly skips them. This inconsistency means CSV-parsed zero-amount rows appear in the transaction list but don't contribute to optimization.

**Fix:** Add `if (amount === 0) continue;` after `isValidAmount()` check in `parseGenericCSV`, matching the PDF parser's behavior.

### C26-03 | LOW | Medium | `apps/web/src/lib/analyzer.ts:166-170`

**cachedCoreRules is never reset when store.reset() is called**

When `analysisStore.reset()` is called (store.svelte.ts:483-493), it clears `cachedCategoryLabels` but does not reset `cachedCoreRules` in analyzer.ts. The `cachedCoreRules` variable (analyzer.ts:47) is a module-level cache that persists even after the store is reset. Since the card data comes from static JSON files, stale data is not a practical concern, but the asymmetry with `cachedCategoryLabels` being reset is inconsistent. Same class as C21-04/C23-02/C25-02.

**Fix:** Export an `invalidateCaches()` function from analyzer.ts and call it from `store.reset()`.

---

## Final Sweep -- Commonly Missed Issues

1. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
2. **No secret leakage**: No API keys, tokens, or credentials in source code.
3. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale.
4. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
5. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
6. **No new security issues**: All fetch calls use same-origin URLs (static JSON files). No user-controlled URLs are fetched.
7. **prefers-reduced-motion**: Handled at both CSS level (global rule in app.css) and JS level (SavingsComparison rAF animation check). Consistent.
8. **Dead code removal confirmed**: `categorizer-ai.ts` is gone, TransactionReview has no AI categorizer import.
9. **parseAmount consistency**: All three parsers (csv.ts, xlsx.ts, pdf.ts) now use `Math.round(parseFloat(...))`. Confirmed consistent.
10. **parseInstallments shared helper**: csv.ts uses the shared `parseInstallments()` function (C24-01 fix). PDF parser also uses `parseInt` directly but that's a simpler context.
11. **Duplicated BANK_SIGNATURES**: Still present between apps/web and packages/parser. Same as C7-07. Low priority.

---

## Summary

- **3 new findings** this cycle (all LOW)
- **3 prior findings confirmed fixed** since last aggregate (C8-01, C25-06/D-106, C22-02)
- **All other prior open findings verified as still open** with accurate file/line references
