# Cycle 86 Comprehensive Code Review

**Date:** 2026-04-22
**Reviewer:** Multi-perspective deep review (code quality, performance, security, UI/UX, architecture, testing, correctness)

---

## Verified Prior Cycle Fixes

All C85 findings verified:

| Finding | Status | Evidence |
|---|---|---|
| C85-01 | **CONFIRMED OPEN** | `SavingsComparison.svelte:237` — annual projection line still shows redundant minus for negative values under "추가 비용" label. The fix from C83-03/C84-01 applied `Math.abs()` to the monthly line (235) and VisibilityToggle, but the annual projection line (237) was missed. |
| C85-02 | **CONFIRMED OPEN** | `SavingsComparison.svelte:237` — annual projection line still missing `+` prefix for positive values, inconsistent with the monthly display which uses `>= 100` threshold. |
| C85-03 | **CONFIRMED OPEN** | `CardDetail.svelte:24-39` — `loadCategories()` called with AbortController correctly now, but the initial `categoryLabelsReady` check blocks the entire rewards table from rendering until categories load. If the fetch fails or is slow, users see nothing. |

---

## New Findings (This Cycle)

### C86-01: SavingsComparison annual projection sign-prefix inconsistency (MEDIUM, HIGH)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:237`
**Description:** The annual projection line on line 237 does NOT apply the same sign-prefix and `Math.abs()` treatment that the monthly line (235) received in C83-03/C84-01. When `opt.savingsVsSingleCard < 0`, the label shows "추가 비용" but the annual value computed as `displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings` IS applied. However, the `+` prefix check `displayedAnnualSavings >= 100` still uses the raw `displayedAnnualSavings` value (which can be negative during animation), not the absolute value. This means:

1. During the count-up animation from a negative start value to 0, `displayedAnnualSavings` can be negative (e.g., -1500), making `>= 100` false (correct, no `+` shown) — BUT `Math.abs()` converts it to 1500 for display, so the user sees "1,500원" without the minus that indicates "additional cost."
2. The monthly line (235) has the same issue in reverse: it applies `Math.abs()` to negative values but the `>= 100` check uses `displayedSavings` (the raw animated value), not the absolute. When `displayedSavings` is negative during animation, the `+` prefix is correctly suppressed, but after the animation settles at 0 for a "추가 비용" scenario, both lines should show the absolute value consistently.

**Concrete failure scenario:** User has negative savings (cherry-pick is worse). The annual line during animation from -5000 to -5000 (no change) shows "-5,000원" which is then converted by `Math.abs()` to "5,000원" — BUT during a reoptimize where savings goes from positive to negative, the animation may pass through values where `displayedAnnualSavings >= 100` is true even though the final target is negative, briefly showing "+X원" before settling.

**Fix:** Use `opt.savingsVsSingleCard >= 0` (the final target, not the animated intermediate) to decide sign prefix, matching the label logic. For the annual projection, compute `displayedAnnualSavings` from the absolute value when the label is "추가 비용."

---

### C86-02: CategoryBreakdown getCategoryColor falls through to uncategorized for unknown dot-notation keys (LOW, MEDIUM)

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:91-96`
**Description:** The `getCategoryColor()` function tries the full key, then the leaf ID (`.pop()`), then falls back to `CATEGORY_COLORS.uncategorized` which is `#d1d5db` (a light gray). In dark mode, this gray has very low contrast against dark backgrounds (already noted in prior cycles as C8-05). However, the specific issue here is that new subcategories added to the YAML taxonomy (e.g., `grocery.traditional_market`) that don't have a dot-notation entry in CATEGORY_COLORS will fall through to the leaf ID lookup. If the leaf ID (e.g., "traditional_market") also isn't present, they get the gray fallback. The dot-notation entries were added in C81-04 but only for the 17 subcategories that existed then. If new subcategories are added, they'll silently get gray.

**Fix:** Add a `CATEGORY_COLORS['uncategorized']` override in dark mode, or add a dark-mode-aware fallback that uses a more visible color.

---

### C86-03: parseGenericCSV header detection can match column-name rows from wrong tables (LOW, MEDIUM)

**File:** `apps/web/src/lib/parser/csv.ts:149-171`
**Description:** The generic CSV parser's header detection (C77-03) requires at least one HEADER_KEYWORD in a row with Korean/alpha text. However, some Korean bank CSV exports include multiple tables in the same file (e.g., a summary table followed by a transaction table). If the summary table's row contains a header keyword like "금액" (which is in HEADER_KEYWORDS), the parser will use that as the header and then fail to parse the actual transaction data correctly.

**Concrete failure scenario:** A Samsung Card export has a summary section with columns "카드명, 이용금액, 혜택금액" followed by the actual transaction table with "이용일, 가맹점명, 이용금액". The parser would match the summary row as the header because "이용금액" is in HEADER_KEYWORDS, and then fail to find date/merchant columns.

**Fix:** Prefer rows that contain BOTH a date keyword AND a merchant keyword over rows that only contain amount keywords. Or require at least 2 distinct keyword categories (date + merchant, or date + amount) to match.

---

### C86-04: VisibilityToggle $effect directly mutates DOM — no Svelte reactivity integration (LOW, HIGH)

**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:62-131`
**Description:** This is a known issue (C18-01/C50-08/C76-04/C79-02/C82-05, carried forward in aggregate). The $effect reads from Svelte reactive state but writes directly to DOM via `classList.toggle()` and `textContent`. This means:
1. The changes are invisible to Svelte's reactivity system — if other components need to know the visibility state, they can't.
2. The cleanup function uses the same cached DOM references, which works but is fragile during Astro View Transitions when elements are swapped.
3. No server-side rendering compatibility — the component only works in the browser.

This is a well-known architectural debt that 18+ cycles have noted. The fix (use Svelte bindings or conditional rendering instead of DOM mutation) is straightforward but risky due to the tight coupling with the results page stat elements.

**Status:** Already deferred per prior cycles. No new information this cycle.

---

### C86-05: XLSX parser header detection uses matchCount >= 2 but doesn't weight keywords by category (LOW, MEDIUM)

**File:** `apps/web/src/lib/parser/xlsx.ts:365-374`
**Description:** The XLSX parser's header detection requires at least 2 matches from `allHeaderKeywords` to identify a header row. However, the keywords list mixes date keywords, merchant keywords, and amount keywords without distinction. A row that contains two amount keywords (e.g., "이용금액" and "승인금액") would match with `matchCount >= 2` even though it's not a valid transaction header (missing date and merchant columns).

**Concrete failure scenario:** A card statement with a "결제금액, 이용금액" summary row would be detected as the header row because both are in `allHeaderKeywords`, and the parser would then look for date/merchant columns and fail.

**Fix:** Require matches from at least 2 distinct keyword categories (date, merchant, amount) similar to the recommendation in C86-03 for CSV.

---

### C86-06: PDF fallback line scanner date regex can match amounts as dates (LOW, LOW)

**File:** `apps/web/src/lib/parser/pdf.ts:350`
**Description:** The fallback line scanner's date regex `fallbackDatePattern` includes `\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])` which matches short MM/DD dates. This pattern could also match amount-like values in Korean statements where amounts are written as "3.5" (unlikely but possible in formatted text). The `isValidShortDate()` guard on line 44-51 prevents most false positives by validating month/day ranges, but the regex itself is overly broad.

**Status:** LOW confidence — the `isValidShortDate()` guard and the `amount > 0` check downstream provide adequate protection. Noting for completeness.

---

### C86-07: SavingsComparison bar comparison can show 0% width when both rewards are zero (LOW, MEDIUM)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:125-136`
**Description:** When both `opt.totalReward === 0` and `opt.bestSingleCard.totalReward === 0`, both `singleBarWidth` and `cherrypickBarWidth` return 0 (lines 126, 132). This means the comparison bars section renders with two zero-width bars, which looks broken — the user sees two empty bars with "0원" next to them.

**Fix:** When both rewards are zero, either hide the bar comparison section entirely, or show both bars at equal width (50%) to indicate no difference.

---

### C86-08: TransactionReview select dropdown renders all categories flat without optgroup (LOW, MEDIUM)

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:304-306`
**Description:** The category select dropdown renders all `categoryOptions` as flat `<option>` elements. Subcategories are indented with leading spaces in their labels (e.g., "  카페"), but this provides poor visual hierarchy. The `<select>` element doesn't support `&nbsp;` for indentation consistently across browsers, and leading spaces may be trimmed by some browsers. Using `<optgroup>` would provide proper visual grouping, but Svelte's `<select>` binding with `<optgroup>` requires restructuring the options data.

**Concrete failure scenario:** On some mobile browsers, leading spaces in option labels are trimmed, making "일반음식점" and "카페" appear at the same indentation level, confusing users who can't tell which are subcategories.

**Fix:** Either use `<optgroup label="외식">` for parent categories, or use a two-level select pattern. Alternatively, use a custom dropdown component with proper visual hierarchy.

---

### C86-09: ReportContent savings line doesn't show annual projection (LOW, LOW)

**File:** `apps/web/src/components/report/ReportContent.svelte:46-49`
**Description:** The report page shows the savings amount with the correct sign-prefix treatment (`>= 100` threshold and `Math.abs()` for negative values under "추가 비용"), consistent with the dashboard. However, the report doesn't show an annual projection at all, while the dashboard does. This is a feature gap rather than a bug, but it means users who print the report don't see the annualized savings figure.

**Status:** Noted as feature gap, not a bug.

---

## Cross-File Interaction Findings

### C86-10: Bank list has 5 independent copies requiring manual synchronization (MEDIUM, HIGH)

**Files involved:**
1. `apps/web/src/lib/parser/detect.ts:8-105` — BANK_SIGNATURES (24 banks)
2. `apps/web/src/lib/parser/csv.ts:936-947` — ADAPTERS registry (10 adapters)
3. `apps/web/src/lib/parser/xlsx.ts:18-170` — BANK_COLUMN_CONFIGS (24 configs)
4. `apps/web/src/components/upload/FileDropzone.svelte:80-105` — ALL_BANKS (24 entries)
5. `apps/web/src/lib/formatters.ts:52-78` — formatIssuerNameKo (24 entries)

**Description:** When a new bank is added, all 5 locations must be updated manually. Missing one leads to:
- Bank detected but not parsed (if ADAPTERS missing) — falls through to generic parser
- Bank detected but wrong column mapping (if XLSX config missing)
- Bank not shown in UI selector (if ALL_BANKS missing)
- Bank shown with raw ID instead of Korean name (if formatIssuerNameKo missing)

This has been flagged since C7 (18+ cycles) and is well-documented. No new information this cycle.

---

### C86-11: cachedCategoryLabels and cachedCoreRules not invalidated on Astro View Transitions (MEDIUM, MEDIUM)

**Files involved:**
- `apps/web/src/lib/store.svelte.ts:378` — cachedCategoryLabels
- `apps/web/src/lib/analyzer.ts:48` — cachedCoreRules

**Description:** Both caches are in-memory module-level variables that survive Astro View Transitions (which swap page content but preserve JS module state). When the user navigates away and back, the caches are still valid from the previous session. This is intentional for performance, but if the underlying data changes (e.g., a new deployment updates cards.json), the stale caches would produce incorrect results until the tab is closed and reopened.

The `invalidateAnalyzerCaches()` function exists and is called from `analysisStore.reset()`, but it's not called on View Transition lifecycle events. This has been noted since C21 (28+ cycles).

---

## Architectural / Design Findings

### C86-12: MerchantMatcher substring scan is O(n) per transaction (MEDIUM, HIGH)

**File:** `packages/core/src/categorizer/taxonomy.ts:70-78`
**Description:** The `findCategory()` substring match iterates over all keywords in the `keywordMap` for every transaction. With ~500 keywords and ~1000 transactions, this is 500,000 string comparisons. The exact match (Map.get) is O(1), and the fuzzy match is also O(n), making the total categorization cost O(n*k) where n=transactions and k=keywords.

This has been flagged since C16 (25+ cycles) as a known performance concern. For the current data sizes it's acceptable, but for larger datasets it would become a bottleneck. A trie or Aho-Corasick automaton would reduce substring matching to O(m) per transaction where m=merchant name length.

**Status:** Already deferred per prior cycles. No new information.

---

## UI/UX Findings

### C86-13: Mobile menu lacks focus trap and Escape-to-close (LOW, MEDIUM)

**File:** `apps/web/src/layouts/Layout.astro:109-148`
**Description:** The mobile slide-in menu (`#mobile-menu`) is toggled via the hamburger button, but:
1. No focus trap — Tab key can move focus to elements behind the menu overlay.
2. No Escape key handler — pressing Escape doesn't close the menu.
3. No focus management — when the menu opens, focus doesn't move into it; when it closes, focus doesn't return to the hamburger button.

These are WCAG 2.2 Level AA requirements for modal-like overlays (SC 2.1.2 No Keyboard Trap, SC 2.4.3 Focus Order).

**Fix:** Add focus trap, Escape key handler, and focus management to the mobile menu toggle logic in `layout.js`.

---

### C86-14: Dark mode CATEGORY_COLORS contrast issues persist (LOW, HIGH)

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84`
**Description:** Several CATEGORY_COLORS have poor contrast in dark mode:
- `utilities: '#6b7280'` (gray) on dark backgrounds — contrast ratio ~2.3:1 (WCAG AA requires 4.5:1 for text)
- `parking: '#78716c'` — similar low contrast
- `toll: '#a8a29e'` — slightly better but still below 4.5:1 on dark backgrounds
- `uncategorized: '#d1d5db'` — adequate contrast on dark but very light on light backgrounds

This has been flagged since C4 (many cycles). The colors serve as bar fills rather than text, so the WCAG text contrast requirement technically doesn't apply, but the bars are still hard to distinguish from the background in dark mode, which is an accessibility concern.

---

## Security Findings

### C86-15: CSP allows 'unsafe-inline' for script-src (MEDIUM, HIGH)

**File:** `apps/web/src/layouts/Layout.astro:42`
**Description:** The Content-Security-Policy meta tag includes `'unsafe-inline'` for script-src, which significantly weakens XSS protection. The comment explains this is required for Astro's Svelte island hydration and layout.js theme toggle. This is a known architectural constraint (noted in the CSP comment itself), not a newly discovered issue.

**Status:** Known limitation. The CSP comment documents the reason and notes the TODO for nonce-based CSP migration.

---

## Test Coverage Findings

### C86-16: No integration test for multi-file upload with different bank formats (MEDIUM, MEDIUM)

**Description:** The `analyzeMultipleFiles()` function in `analyzer.ts` handles parsing multiple files potentially from different banks, but there are no integration tests that verify:
1. Correct merging of transactions from different banks
2. Correct ID prefixing to prevent collision (the `f${fileIndex}-` prefix)
3. Correct monthly breakdown computation across multiple files
4. Correct previousMonthSpending computation from multiple months

The existing test files (`__tests__/analyzer-adapter.test.ts`, `__tests__/parser-encoding.test.ts`, `__tests__/parser-date.test.ts`) test individual parsing components but not the full multi-file analysis pipeline.

**Fix:** Add integration tests covering multi-file upload scenarios with at least 2 different bank formats.

---

## Summary of New Findings This Cycle

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C86-01 | MEDIUM | HIGH | `SavingsComparison.svelte:237` | Annual projection sign-prefix uses animated value instead of final target for `+` prefix decision |
| C86-02 | LOW | MEDIUM | `CategoryBreakdown.svelte:91-96` | getCategoryColor falls through to low-contrast gray for unknown dot-notation keys |
| C86-03 | LOW | MEDIUM | `csv.ts:149-171` | Generic CSV header detection can match summary table rows containing amount keywords |
| C86-04 | LOW | HIGH | `VisibilityToggle.svelte:62-131` | $effect directly mutates DOM (known issue, 18+ cycles) |
| C86-05 | LOW | MEDIUM | `xlsx.ts:365-374` | XLSX header detection uses matchCount >= 2 without keyword category weighting |
| C86-06 | LOW | LOW | `pdf.ts:350` | Fallback date regex can match amount-like values (guarded by isValidShortDate) |
| C86-07 | LOW | MEDIUM | `SavingsComparison.svelte:125-136` | Zero-width bars when both rewards are zero looks broken |
| C86-08 | LOW | MEDIUM | `TransactionReview.svelte:304-306` | Category select lacks optgroup for visual hierarchy |
| C86-09 | LOW | LOW | `ReportContent.svelte:46-49` | Report doesn't show annual projection (feature gap) |
| C86-10 | MEDIUM | HIGH | Multiple files | Bank list has 5 independent copies requiring manual sync (known, 18+ cycles) |
| C86-11 | MEDIUM | MEDIUM | `store.svelte.ts`, `analyzer.ts` | cachedCategoryLabels/cachedCoreRules not invalidated on View Transitions (known, 28+ cycles) |
| C86-12 | MEDIUM | HIGH | `taxonomy.ts:70-78` | MerchantMatcher substring scan O(n) per transaction (known, 25+ cycles) |
| C86-13 | LOW | MEDIUM | `Layout.astro:109-148` | Mobile menu lacks focus trap and Escape-to-close |
| C86-14 | LOW | HIGH | `CategoryBreakdown.svelte:6-84` | CATEGORY_COLORS dark mode contrast issues (known, many cycles) |
| C86-15 | MEDIUM | HIGH | `Layout.astro:42` | CSP allows 'unsafe-inline' for script-src (known, documented in code) |
| C86-16 | MEDIUM | MEDIUM | Missing test file | No integration test for multi-file upload with different bank formats |
