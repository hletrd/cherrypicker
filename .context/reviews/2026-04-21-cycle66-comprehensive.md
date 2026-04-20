# Cycle 66 Comprehensive Code Review -- 2026-04-21

**Scope:** Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper. Cross-file interaction analysis. Fix verification of prior cycle findings. New issue discovery.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-65 findings are confirmed fixed except as noted in the aggregate.

| Finding | Status | Evidence |
|---|---|---|
| C64-01 | **FIXED** | `parser-date.test.ts:9-10` imports from production `date-utils.ts`. 12 test cases cover month-aware day validation including leap years, century boundaries. |
| C64-02 | **FIXED** | `parser/index.ts:20-23` encoding list is `['utf-8', 'cp949']` with EUC-KR removed. |
| C65-01 | **FIXED** | `pdf.ts:32-50` now uses `MAX_DAYS_PER_MONTH` table instead of raw `day <= 31`. `isValidShortDate()` performs month-aware validation. |
| C65-02 | OPEN (LOW) | `date-utils.ts:100,124` still has redundant `day >= 1` pre-check before `isValidDayForMonth`. `isValidDayForMonth` already checks `day >= 1`. Inconsistent style but no functional impact. |
| C62-11 | OPEN (LOW) | `store.svelte.ts:154-165` logs non-quota errors but returns 'corrupted' for ALL non-quota errors including `SyntaxError` from circular references. |

---

## New Findings (This Cycle)

### C66-01: Server-side date-utils.ts lacks month-aware day validation
**Severity:** MEDIUM | **Confidence:** HIGH
**File:** `packages/parser/src/date-utils.ts:43,52,64,74,85,95`

The server-side `parseDateStringToISO` in `packages/parser/src/date-utils.ts` still uses `day >= 1 && day <= 31` for all branches, while the web-side equivalent in `apps/web/src/lib/parser/date-utils.ts` uses `isValidDayForMonth(year, month, day)` (fixed in C63-04). This means the server-side parser (CLI, tools/scraper) will accept impossible dates like "2024-02-31" or "2024-04-31" that the web parser correctly rejects. Both parsers share the same codebase and same Korean credit card data -- the validation should be consistent.

**Concrete failure scenario:** A CSV statement with date "2024-02-31" parsed via the CLI (`bun run tools/cli/src/index.ts analyze`) would produce `2024-02-31` as a date string, which is invalid. The web parser would correctly reject it and return the raw input.

**Suggested fix:** Port `daysInMonth()`, `isValidDayForMonth()`, and the updated validation logic from the web-side `date-utils.ts` to the server-side version.

### C66-02: cachedCategoryLabels stale when cards.json is redeployed mid-session
**Severity:** MEDIUM | **Confidence:** HIGH (9 cycles agree)
**File:** `apps/web/src/lib/store.svelte.ts:327-334`

The `cachedCategoryLabels` map is built once from `loadCategories()` and cached for the entire browser session. If `cards.json` or `categories.json` is redeployed on the server while the user has an active session, the cached labels will be stale and may not match the new category IDs. The `invalidateAnalyzerCaches()` call in `reset()` clears `cachedCoreRules` but also needs to clear `cachedCategoryLabels` (which it does at line 524). However, `reset()` is only called explicitly -- there is no automatic invalidation when the fetch cache detects a changed resource.

This is a carry-forward from C33-02/C62-04. The staleness risk is real but the impact is limited: category labels are display-only and a page refresh resolves it. A proper fix would involve cache-busting via ETag/Last-Modified headers or a version query parameter.

### C66-03: MerchantMatcher/taxonomy substring scan remains O(n) per transaction
**Severity:** MEDIUM | **Confidence:** HIGH (7 cycles agree)
**File:** `packages/core/src/categorizer/taxonomy.ts:71-76`

`CategoryTaxonomy.findCategory()` iterates all entries in `keywordMap` for the substring match (step 2) and fuzzy match (step 3) paths. With ~10,000 keywords, this is O(n) per merchant name per transaction. For a statement with 500 transactions, that's 5,000,000 substring comparisons. The exact-match path (step 1) is O(1) via Map lookup, but the fallback paths dominate for unmatched merchants.

This is a carry-forward from C33-01/C62-01. A potential fix would be to use a trie or Aho-Corasick automaton for the substring scan, or to precompute n-gram indexes. The impact is on large statements or batch analysis -- for typical single-month statements (<200 transactions), the latency is acceptable.

### C66-04: persistToStorage returns 'corrupted' for non-quota, non-AbortError failures
**Severity:** LOW | **Confidence:** HIGH (4 cycles agree)
**File:** `apps/web/src/lib/store.svelte.ts:154-166`

The `persistToStorage` function logs non-quota errors (like `SyntaxError` from circular references in `JSON.stringify`) but still returns `{ kind: 'corrupted', truncatedTxCount: null }`. This causes the UI to show "거래 내역을 불러오지 못했어요" (can't load transaction details) even when the issue was a serialization error rather than data corruption. The user is told to "re-analyze" but re-analyzing won't fix a circular reference bug.

A better approach would be to distinguish between "save failed" (serialization error) and "data corrupted on load" (validation failure), with different user-facing messages.

### C66-05: CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy
**Severity:** LOW | **Confidence:** HIGH (3 cycles agree)
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:13-27`

The `FALLBACK_CATEGORIES` list in TransactionReview is a hardcoded subset of 13 categories, while the YAML taxonomy in `packages/rules/data/categories.yaml` defines 40+ categories. If the fetch to `categories.json` fails, the fallback only covers a fraction of the available categories, and the user would see raw IDs for uncategorized entries like "delivery", "traditional_market", etc.

### C66-06: Server-side parser uses EUC-KR while web-side uses CP949
**Severity:** LOW | **Confidence:** HIGH
**File:** `packages/parser/src/index.ts:43` vs `apps/web/src/lib/parser/index.ts:23`

The server-side `parseStatement()` in `packages/parser/src/index.ts` falls back to `euc-kr` encoding, while the web-side `parseFile()` uses `cp949` (fixed in C64-02). CP949 is a strict superset of EUC-KR, so the server-side parser may produce more replacement characters for certain Korean characters that exist in CP949 but not in EUC-KR. The two code paths should use the same encoding strategy.

**Suggested fix:** Update the server-side parser to use CP949 instead of EUC-KR, matching the web-side behavior.

### C66-07: build-stats.ts fallback values will drift from actual card data
**Severity:** LOW | **Confidence:** HIGH (3 cycles agree)
**File:** `apps/web/src/lib/build-stats.ts:16-18`

The hardcoded fallback values (`totalCards: 683`, `totalIssuers: 24`, `totalCategories: 45`) will become stale as new cards are added. The fallback is only used when `cards.json` is unavailable at build time, which is an edge case, but the values should be updated periodically or derived from the YAML files at build time.

### C66-08: formatIssuerNameKo and CATEGORY_COLORS/CATEGORY_COLORS hardcoded maps in components will drift
**Severity:** LOW | **Confidence:** MEDIUM
**File:** `apps/web/src/lib/formatters.ts:52-79`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`

`formatIssuerNameKo()` has a hardcoded map of 24 issuer IDs to Korean names. If a new issuer is added to the YAML data, this map must be manually updated. Similarly, `CATEGORY_COLORS` in CategoryBreakdown.svelte maps category IDs to hex colors; new categories would default to `uncategorized` color.

### C66-09: date-utils.ts redundant `day >= 1` pre-check before isValidDayForMonth
**Severity:** LOW | **Confidence:** HIGH (carry-forward from C65-02)
**File:** `apps/web/src/lib/parser/date-utils.ts:100,124`

Lines 100 and 124 check `day >= 1` before calling `isValidDayForMonth(year, month, day)`, which itself checks `day >= 1` at line 19. The `day >= 1` check is redundant. Other branches (full date, YYYYMMDD, short-year, Korean full) do NOT have this redundant pre-check. Inconsistent style but no functional impact.

### C66-10: BANK_SIGNATURES duplicated between packages/parser and apps/web
**Severity:** LOW | **Confidence:** HIGH (carry-forward from C7-07)
**File:** `packages/parser/src/detect.ts` vs `apps/web/src/lib/parser/detect.ts`

Both files define `BANK_SIGNATURES` with the same 24 bank entries. Any update to one must be mirrored to the other, or they will diverge. The server-side version has slightly different pattern ordering but the same content.

---

## Cross-File Interaction Analysis

### Parser Pipeline Consistency
The three parser paths (web CSV, web XLSX, web PDF) now share `parseDateStringToISO()` from the web `date-utils.ts`, which includes `isValidDayForMonth()`. However, the server-side `date-utils.ts` (used by `packages/parser`) still lacks this validation. This creates a consistency gap between the web app and the CLI/scraper tools.

### Store Persistence Flow
The `persistToStorage` -> `loadFromStorage` flow is robust for quota errors but lumps all non-quota errors into 'corrupted'. The `_truncatedTxCount` tracking (C22-03) works correctly -- when transactions are omitted due to size, the count is recorded and the warning accurately shows how many were lost.

### Category Label Caching
The `cachedCategoryLabels` in `store.svelte.ts` is properly invalidated on `reset()`. The `cachedCoreRules` in `analyzer.ts` is also properly invalidated. However, both caches are session-scoped with no mechanism to detect stale data from redeployed static JSON files.

---

## Final Sweep: Commonly Missed Issues

1. **No XSS risk from parsed data:** Transaction merchant names and amounts flow through Svelte's template system which auto-escapes. No innerHTML usage found. CSP meta tag restricts script-src to 'self' + 'unsafe-inline'.

2. **No secrets or API keys in source:** No hardcoded API keys, tokens, or credentials found. The Claude API key for the scraper tool is expected to be provided via environment variable.

3. **Error boundary coverage:** All async operations in the store (analyze, reoptimize) are wrapped in try/catch with user-facing Korean error messages. Parser errors are collected in arrays and displayed in the UI.

4. **Accessibility:** Skip-to-content link present. ARIA labels on interactive elements. Keyboard navigation supported on expandable rows. Focus management in VisibilityToggle uses focusin/focusout. Dark mode contrast for CategoryBreakdown bars is still a known low-severity issue (carry-forward from C4-09/C8-05).

5. **Print stylesheet:** Present in app.css (lines 88-100) with proper nav/footer hiding and monochrome body text. Dark mode print fix confirmed working (carry-forward from C60/C61).
