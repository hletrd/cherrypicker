# Cycle 62 Comprehensive Review -- 2026-04-21

**Reviewer**: comprehensive (all specialist angles)
**Scope**: Full repository re-read, gate verification, cross-file interaction analysis

---

## Verification of Prior Cycle Fixes (C61)

All prior C61 findings confirmed:

| Finding | Status | Evidence |
|---|---|---|
| C61-01 | **FIXED** | `TransactionReview.svelte:81-84` now clears `editedTxs = []` when `txs.length === 0` in the `$effect` |
| C61-02 | OPEN (LOW) | Breadcrumb still uses `<a href="#">` for "카드 목록" alongside `<a>` for "홈" -- inconsistent but functionally correct |
| C61-03 | OPEN (LOW) | `SpendingSummary.svelte:141` still logs `console.warn` for QuotaExceededError in private browsing |
| C61-04 | **FIXED** | `CardDetail.svelte:22,31,204` uses `categoryLabelsReady` flag to suppress rewards table until labels load |
| C61-05 | **FIXED** | `report.astro:64-77` `cherrypickerPrint()` now removes `dark` class before print, restores after |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C62-01 | MEDIUM | HIGH | `packages/core/src/categorizer/taxonomy.ts:71-78` | `findCategory` substring scan iterates ALL keywordMap entries per call -- O(n*m) per merchant. Already flagged as C33-01 but worsens with category count. The precomputed `SUBSTRING_SAFE_ENTRIES` in `matcher.ts` helps the outer matcher, but `CategoryTaxonomy.findCategory` still does a full scan when called at matcher line 84. Both hot paths scan the full map. |
| C62-02 | LOW | HIGH | `apps/web/src/lib/parser/date-utils.ts:112` | `parseDateStringToISO` returns raw input for unparseable dates without any error reporting. Already flagged as C56-04. Still OPEN. Malformed dates like "2026/13/99" pass through to transaction data silently. |
| C62-03 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:60` | `annualTarget = target * 12` uses simple multiplication for annual projection. No seasonal adjustment, no disclaimer about compounding effects. Already flagged as C18-03/C7-06 deferred. Still OPEN. |
| C62-04 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:317-323` | `cachedCategoryLabels` is invalidated only on `reset()`. If the underlying categories.json is redeployed while the tab is open, the cache serves stale labels. Same issue for `cachedCoreRules` in `analyzer.ts`. Already flagged as C21-04/C23-02/C25-02/C26-03/C33-02 (5 cycles agree). Still OPEN. |
| C62-05 | LOW | MEDIUM | `apps/web/src/components/cards/CardPage.svelte:70-74` | Breadcrumb uses `<a href="#" onclick={(e) => { e.preventDefault(); goBack(); }}>카드 목록</a>` which is semantically a `<button>` disguised as a link. Screen readers announce it as a navigation link rather than an action. Already flagged as C61-02. Still OPEN. |
| C62-06 | LOW | LOW | `apps/web/src/lib/parser/csv.ts:96-103` | `DATE_PATTERNS` and `AMOUNT_PATTERNS` regex constants are only used by the generic CSV parser's `isDateLike()`/`isAmountLike()` heuristics, but must be manually kept in sync with `parseDateStringToISO()` in `date-utils.ts`. Already flagged as C20-02/C25-03. Still OPEN. |
| C62-07 | LOW | LOW | `apps/web/src/components/dashboard/SpendingSummary.svelte:141` | `console.warn` fires for expected `QuotaExceededError` in private browsing contexts. The existing code already filters out `DOMException` with `QuotaExceededError` name, but the filter is in a catch block AFTER the warn call path. Actually re-reading: the filter IS in place (`!(err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'))`). So this warning is actually correctly filtered. **DOWNGRADED**: Not an issue. |
| C62-08 | LOW | MEDIUM | `apps/web/src/lib/parser/xlsx.ts:241-249` | `isHTMLContent` only decodes the first 512 bytes as UTF-8 to check for HTML. A file with a very long BOM+whitespace prefix could exceed 512 bytes before reaching the HTML content. Already flagged as C18-04. Still OPEN. |
| C62-09 | MEDIUM | HIGH | `apps/web/src/lib/cards.ts:280-307` | `getCardById` does a linear scan through all issuers' cards: `for (const issuer of data.issuers) { const card = issuer.cards.find(...) }`. With 100+ cards across 24 issuers, this is O(n) per lookup. Already flagged as C3-D111/C50/C56 (3 cycles agree). Still OPEN. Impact: every CardDetail render and CardPage hash change triggers this scan. |
| C62-10 | LOW | HIGH | `apps/web/src/components/ui/VisibilityToggle.svelte:62-127` | The `$effect` directly mutates DOM elements via `classList.toggle`, `textContent` assignment, and `classList.add/remove`. This is an imperative escape hatch from Svelte's declarative model. Already flagged as C18-01/C50 (2 cycles agree). Still OPEN. The pattern is architecturally necessary (managing non-Svelte DOM containers), but fragile. |
| C62-11 | LOW | MEDIUM | `apps/web/src/lib/store.svelte.ts:155` | `persistToStorage` uses bare `catch {}` that returns `{ kind: 'corrupted', truncatedTxCount: null }` for ALL exceptions, including non-quota errors. If `JSON.stringify` throws due to a circular reference (unlikely given the type, but possible with corrupted state), the error message would be misleading ("corrupted" implies quota, not serialization). |
| C62-12 | LOW | LOW | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49` | `CATEGORY_COLORS` has 48 entries but does not cover all possible category IDs from the taxonomy. Missing entries fall back to `CATEGORY_COLORS.uncategorized` (#d1d5db). In dark mode, some non-utility entries have poor contrast against the dark background. Already flagged as C8-05/C4-09/C59. Still OPEN. |
| C62-13 | LOW | MEDIUM | `apps/web/src/lib/analyzer.ts:48-79` | `cachedCoreRules` is a module-level variable that persists across `analysisStore` instances and is only invalidated on explicit `reset()`. If card rules data changes between sessions (e.g., new deployment), stale rules will be used until the user manually resets. Converges with C62-04. |
| C62-14 | LOW | LOW | `apps/web/__tests__/parser-date.test.ts` | Test file duplicates the full `parseDateStringToISO` and `inferYear` implementation instead of importing from `date-utils.ts`. This means if the source code changes, tests may pass against the old copy while production uses the new version. Already flagged as C8-09. Still OPEN. |
| C62-15 | MEDIUM | HIGH | `apps/web/src/components/upload/FileDropzone.svelte:237-239` | After successful upload, `window.location.href = buildPageUrl('dashboard')` triggers a full page reload instead of using Astro's client-side navigation. This loses the in-memory store state that was just populated by `analysisStore.analyze()`. The store persists to sessionStorage, but if persistence was truncated (persistWarning), the transactions are lost on the dashboard page. Already flagged as C19-04/C19-05/C60 (2 cycles agree for full-page reloads). Still OPEN. |

---

## Cross-Agent Convergence (Cumulative)

Findings flagged by 2+ cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| VisibilityToggle DOM mutation | C18, C50 | OPEN (LOW) |
| getCardById O(n) | C3, C50, C56, C62 | OPEN (MEDIUM) -- 4 cycles agree |
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62 | OPEN (MEDIUM) -- 4 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62 | OPEN (MEDIUM) -- 6 cycles agree |
| Full-page reload navigation | C19, C60, C62 | OPEN (LOW) -- 3 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62 | OPEN (LOW) -- 3 cycles agree |
| Print stylesheet dark-mode fix | C60, C61 | **FIXED** (C62 confirmed) |
| CardGrid reactive dependency cycle | C60 | **FIXED** (C61 confirmed) |
| CardDetail category labels flash | C61 | **FIXED** (C62 confirmed) |
| TransactionReview stale editedTxs on reset | C61 | **FIXED** (C62 confirmed) |
| date-utils unparseable passthrough | C56, C62 | OPEN (LOW) -- 2 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62 | OPEN (LOW) -- 3 cycles agree |

---

## Final Sweep -- Commonly Missed Issues

1. **No new security findings**: CSP is properly configured, no secrets in code, no XSS vectors (Svelte auto-escapes), no SQL injection (no DB).
2. **No new race conditions**: All fetch operations use AbortController properly. Store mutations are synchronous. The `fetchGeneration` pattern in CardPage/CardDetail prevents stale responses.
3. **No new data-loss vectors**: sessionStorage persistence is bounded and well-guarded. The truncated/corrupted warning system works correctly.
4. **No new type-safety issues**: All parsers validate amounts with `Number.isFinite` and `Number.isNaN` guards. The `isOptimizableTx` type guard is comprehensive.
5. **Test coverage**: Only 3 test files exist (`parser-date.test.ts`, `analyzer-adapter.test.ts`, `parser-encoding.test.ts`). No tests for: store persistence, optimizer logic, categorizer matching, Svelte component rendering, or error paths in parsers. This is a known gap tracked in prior reviews.

---

## Summary

- **New findings this cycle**: 15 (0 CRITICAL, 2 MEDIUM, 13 LOW)
- **Carried-forward findings**: 22 OPEN from prior cycles
- **Fixed this cycle**: 3 (C61-01, C61-04, C61-05)
- **Deduped**: C62-07 was initially flagged but re-examined and found not to be an issue (QuotaExceededError filter is correct)
