# Cycle 63 Comprehensive Review -- 2026-04-21

**Reviewer**: comprehensive (all specialist angles)
**Scope**: Full repository re-read with focus on verifying prior fixes and finding new issues missed by 62 prior cycles

---

## Verification of Prior Cycle Fixes (C62)

All prior C62 findings confirmed as still fixed or OPEN as noted:

| Finding | Status | Evidence |
|---|---|---|
| C62-09 (getCardById O(n)) | **FIXED** | `cards.ts:158-168` builds `cardIndex` Map on first load; `getCardById` at line 304 uses `cardIndex.get()` for O(1) lookup with linear scan fallback |
| C61-02 (breadcrumb `<a>` to `<button>`) | **FIXED** | `CardPage.svelte:70-74` uses `<button type="button">` instead of `<a href="#">` |
| C62-15 (FileDropzone full-page reload) | **FIXED** | `FileDropzone.svelte:241-246` uses `import('astro:transitions/client')` with `navigate()` fallback to `window.location.href` |
| C62-15 (CardDetail full-page reload) | **FIXED** | `CardDetail.svelte:275-280` uses `import('astro:transitions/client')` with `navigate()` fallback |
| C62-11 (persistToStorage bare catch) | **PARTIALLY FIXED** | `store.svelte.ts:154-165` now catches `DOMException` for QuotaExceededError and logs non-quota errors to `console.warn`, but still returns `{ kind: 'corrupted' }` for ALL non-quota errors — misleading for serialization errors |
| C49-01 (isSubstringSafeKeyword dead code) | **FIXED** | Function no longer exists in codebase |
| C56-04 (date-utils unparseable passthrough) | **OPEN (LOW)** | `date-utils.ts:112` still returns raw input for unparseable dates |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C63-01 | LOW | HIGH | `apps/web/src/lib/store.svelte.ts:327` | `cachedCategoryLabels` is a module-level variable inside `createAnalysisStore()` closure. It is only invalidated on `reset()`. If `loadCategories()` returns updated data (e.g., new deployment while tab is open), the cache serves stale labels. This converges with C62-04/C33-02 but the specific scope is the closure-level cache in `createAnalysisStore`, not the module-level `cachedCoreRules` in `analyzer.ts`. Already known, no new signal. |
| C63-02 | LOW | MEDIUM | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:193` | Bar chart uses inline `style="width: {(cat.percentage / maxPercentage) * 100}%"` — when `maxPercentage` is very small (e.g., 1%), and a category has 0.9%, the bar width is 90%. But categories under 2% raw are grouped into "other", so this is self-correcting. No issue. |
| C63-03 | LOW | HIGH | `packages/core/src/categorizer/taxonomy.ts:71-78` | `findCategory` still does full keywordMap iteration for substring/fuzzy matching. Precomputed `SUBSTRING_SAFE_ENTRIES` in `matcher.ts` optimizes step 2 of `MerchantMatcher.match()`, but step 3 calls `this.taxonomy.findCategory()` which still iterates ALL entries. Converges with C33-01/C62-01. Still OPEN. |
| C63-04 | MEDIUM | MEDIUM | `apps/web/src/lib/parser/date-utils.ts:46-112` | `parseDateStringToISO` does not validate that day numbers are appropriate for the given month (e.g., February 31 passes validation, producing "2026-02-31" which is not a real date). This is a known simplification — strict date validation would require knowing the year and month to determine max days (28/29/30/31). The current range check (1-31) is a pragmatic lower bound. However, downstream code that uses these dates for sorting/filtering (e.g., `allTransactions.sort((a, b) => a.date.localeCompare(b.date))`) would produce incorrect ordering for impossible dates. New finding — not previously flagged in any cycle. |
| C63-05 | LOW | MEDIUM | `apps/web/src/components/dashboard/SavingsComparison.svelte:60` | `annualTarget = target * 12` is a simple annualized projection with no disclaimer about compounding or seasonal variation. The template text says "최근 월 기준 단순 연환산" which is an adequate disclaimer. Converges with C18-03/C62-03. Still OPEN. |
| C63-06 | LOW | LOW | `apps/web/src/lib/formatters.ts:1-2` | `getIssuerFromCardId` splits on `-` and takes the first segment. If a card ID format ever changes to not include the issuer prefix (e.g., UUID-based IDs), this would silently return 'unknown'. Currently all card IDs follow the `{issuer}-{name}` pattern, so this is a latent risk, not an active bug. |
| C63-07 | MEDIUM | MEDIUM | `apps/web/src/lib/parser/index.ts:23-36` | Encoding detection loop tries UTF-8, EUC-KR, CP949 in order and picks the one with fewest replacement characters (`\uFFFD`). However, the loop breaks early when `replacementCount < 5` — this means if UTF-8 happens to produce < 5 replacement characters for a file that is actually EUC-KR, the wrong encoding is selected and Korean characters are decoded as garbage. This is unlikely for real Korean text (EUC-KR encoded Korean typically produces many replacement characters when decoded as UTF-8), but the heuristic could fail for small files or files with mostly ASCII content and a few Korean characters. New finding — not previously flagged in any cycle. |

---

## Cross-Agent Convergence (Cumulative)

Findings flagged by 2+ cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| getCardById O(n) | C3, C50, C56, C62 | **FIXED** (C63 confirmed) |
| Breadcrumb `<a>` to `<button>` | C61, C62 | **FIXED** (C63 confirmed) |
| Full-page reload navigation | C19, C60, C62 | **FIXED** (C63 confirmed) |
| FileDropzone Astro navigate | C62 | **FIXED** (C63 confirmed) |
| CardDetail Astro navigate | C62 | **FIXED** (C63 confirmed) |
| isSubstringSafeKeyword dead code | C49 | **FIXED** (C63 confirmed) |
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63 | OPEN (MEDIUM) -- 5 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63 | OPEN (MEDIUM) -- 7 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63 | OPEN (LOW) -- 4 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63 | OPEN (LOW) -- 3 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62 | OPEN (LOW) -- 3 cycles agree |
| persistToStorage bare catch | C62, C63 | OPEN (LOW) -- 2 cycles agree |

---

## Final Sweep -- Commonly Missed Issues

1. **No new security findings**: CSP is properly configured with `unsafe-inline` (required for Astro/Svelte), no secrets in code, no XSS vectors (Svelte auto-escapes), no SQL injection (no DB). The TODO for nonce-based CSP remains.
2. **No new race conditions**: All fetch operations use AbortController properly. Store mutations are synchronous. The `fetchGeneration` pattern in CardPage/CardDetail prevents stale responses.
3. **No new data-loss vectors**: sessionStorage persistence is bounded and well-guarded. The truncated/corrupted warning system works correctly.
4. **No new type-safety issues**: All parsers validate amounts with `Number.isFinite` and `Number.isNaN` guards. The `isOptimizableTx` type guard is comprehensive.
5. **Test coverage**: Same 3 test files as before. No tests for: store persistence, optimizer logic, categorizer matching, Svelte component rendering, or error paths in parsers. This is a known gap tracked in prior reviews.
6. **New finding C63-04**: Day-of-month validation does not account for month-specific day limits (e.g., Feb 31 would pass). This is a new finding not previously flagged in any cycle.
7. **New finding C63-07**: Encoding detection heuristic can fail for small files with mostly ASCII content. This is a new finding not previously flagged in any cycle.

---

## Summary

- **New findings this cycle**: 7 (0 CRITICAL, 2 MEDIUM, 5 LOW)
- **New genuinely novel findings**: 2 (C63-04, C63-07)
- **Convergence findings**: 5 (confirming prior cycles)
- **Carried-forward findings**: 22 OPEN from prior cycles
- **Fixed this cycle (confirmed)**: 5 (C62-09, C61-02, C62-15 FileDropzone+CardDetail, C49-01)
