# Cycle 24 Comprehensive Code Review -- 2026-04-20

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/`, `packages/parser/`, `packages/rules/`, `packages/viz/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern (line 75-83) -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:321` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:154` "거래 내역을 불러오지 못했어요" for corruption case; truncation case now shows count |
| C8-01 | OPEN (MEDIUM) | `categorizer-ai.ts` trimmed to ~40 lines of dead code stub. TransactionReview.svelte:6 now has single-line comment (improved from 8-line block). Dead code still present. |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte` still uses hardcoded `CATEGORY_COLORS` with poor dark mode contrast on some entries |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
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
| C23-01 | **FIXED** | greedy.ts:269-270 now uses `Number.isFinite(tx.amount)` guard alongside `tx.amount > 0` |
| C23-02 | OPEN (LOW) | `analyzer.ts:47` `cachedCoreRules` never invalidated -- same class as C21-04 |
| C23-03 | OPEN (LOW) | `SpendingSummary.svelte:138` `monthDiff` NaN guard now present (C23-03 fix in prior cycle) |
| C23-04 | OPEN (LOW) | `csv.ts:100-108` generic CSV header detection heuristic -- low risk, bank-specific adapters avoid this |
| C23-05 | OPEN (LOW) | `csv.ts:922-969` fallthrough to generic parser when no bank detected -- expected behavior |
| D-106 | OPEN (LOW) | `pdf.ts:260` `catch {}` -- bare catch, but returning null is intended fallback |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C24-01 | MEDIUM | High | `apps/web/src/lib/parser/csv.ts:129-133` and all bank adapters | The `changeCategory` in TransactionReview.svelte uses `editedTxs.map()` to create a new array on every category change (C22-05). While reviewing the CSV parser, I found a more impactful issue: the generic CSV parser and all 10 bank adapters share the same pattern for installment parsing but the code is duplicated 10+ times (lines 263-269, 332-338, 402-408, 472-478, 541-547, 610-616, 680-686, 749-755, 819-825, 889-894). Each duplicate has the exact same NaN guard comment. If the installment parsing logic ever needs to change (e.g., handling negative installments), all 10 copies must be updated. This is a maintenance risk but not a correctness bug. |
| C24-02 | MEDIUM | High | `apps/web/src/lib/store.svelte.ts:264` | `clearStorage()` has a bare `catch { /* SSR */ }` with no error logging. If sessionStorage removal fails for a reason other than SSR (e.g., SecurityError in a sandboxed iframe), the failure is silently swallowed with no diagnostic trail. While not a correctness bug, this makes debugging storage issues harder. |
| C24-03 | LOW | High | `apps/web/src/components/dashboard/SpendingSummary.svelte:131-138` | The `monthDiff` calculation on line 137 correctly uses `Number.isFinite()` guard for y1/y2/m1/m2, and line 138 correctly handles `!Number.isFinite(monthDiff)` by falling through to the "이전 실적" label. The NaN display issue from C23-03 was fixed in the prior cycle. However, there is still a subtle edge case: when `monthDiff === 0` (e.g., two monthlyBreakdown entries for the same month due to a data anomaly), the template would show "0개월 전 실적" which is confusing. A `monthDiff === 0` guard showing "같은 달 실적" would be clearer. |
| C24-04 | LOW | Medium | `apps/web/src/lib/cards.ts:207-211` | When `loadCardsData()` is called with an external AbortSignal and the shared in-flight fetch is aborted by that signal, the `chainAbortSignal` call on line 210 adds the new caller's abort listener to the *shared* controller. If a second caller then starts a new fetch (after the abort resets the cache), the old listener is still attached to the old controller (which is now abandoned). The `{ once: true }` ensures the listener fires at most once, so there is no functional bug, but the dangling listener on a dead controller is conceptually untidy. |
| C24-05 | LOW | Medium | `apps/web/src/lib/formatters.ts:190-194` | `buildPageUrl()` strips leading slashes from the path and adds one between base and path. If `BASE_URL` is `'/'` (the default), and the path is `'dashboard'`, the result is `'/dashboard'` which is correct. But if `BASE_URL` is something like `'/cherrypicker/'` and path is empty string, the result would be `'/cherrypicker/'` (trailing slash). If path has a trailing slash like `'dashboard/'`, the result would be `'/cherrypicker/dashboard/'` -- typically not desired for page URLs. Edge case only; all current call sites pass bare page names without slashes. |
| C24-06 | LOW | High | `packages/core/src/optimizer/greedy.ts:224` | `totalSpending` in `buildCardResults` is computed as `assignedTransactions.reduce((sum, tx) => sum + tx.amount, 0)`. Since the optimizer already filters out transactions with `amount <= 0` or non-finite amounts (line 270), this is safe in practice. However, if `buildCardResults` were ever called with unfiltered transactions (e.g., from a future code path), negative amounts would reduce totalSpending. The function does not guard against this internally. Low risk since the only caller passes filtered data. |

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
11. **C23-01 (greedy.ts NaN guard) is now fixed**: Line 269-270 uses `Number.isFinite(tx.amount)` alongside `tx.amount > 0`.

---

## Summary

- **6 new findings** this cycle (2 MEDIUM, 4 LOW)
- **3 prior findings confirmed fixed** since last review (C23-01, C23-03 partially, C22-01/02/03 confirmed from prior)
- **All other prior open findings verified as still open** with accurate file/line references
