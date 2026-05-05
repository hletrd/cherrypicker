# Cycle 86 Implementation Plan

**Date:** 2026-04-22
**Source:** `.context/reviews/2026-04-22-cycle86-comprehensive.md`

---

## Review Summary

16 findings identified in cycle 86. The most significant actionable finding is C86-01 (the SavingsComparison annual projection sign-prefix issue, a continuation of C85-01/C85-02 which were marked DONE but the fixes were incomplete). Several other findings are LOW severity and have been carried forward from prior cycles.

**Critical note:** C85-01 and C85-02 were marked DONE in the cycle 85 plan, but verification in cycle 86 shows the fixes were NOT actually applied to the annual projection line at `SavingsComparison.svelte:237`. The annual projection still lacks both `Math.abs()` for negative values and the `+` prefix threshold. This cycle must apply these fixes properly.

---

## Task 1: Fix annual projection sign-prefix and Math.abs (C86-01 / C85-01 / C85-02)

- **Finding:** C86-01 (MEDIUM, HIGH confidence) + C85-01 (MEDIUM, HIGH) + C85-02 (LOW, MEDIUM)
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:237`
- **Problem:** The annual projection line on line 237 has two issues:
  1. When `displayedAnnualSavings` is negative (under "추가 비용"), the raw negative value is passed to `formatWon()`, producing a redundant minus sign that the label already communicates. The monthly line (235) was fixed in C83-03/C84-01 to use `Math.abs()`, but the annual line was not.
  2. The `+` prefix uses `displayedAnnualSavings >= 100` which checks the animated intermediate value instead of the final target. During animation from positive to negative, this can briefly show an incorrect `+` prefix.
- **Fix:** Use the final target (`opt.savingsVsSingleCard`) for sign-prefix decisions instead of the animated intermediate value. Apply `Math.abs()` for negative annual values matching the monthly line pattern:
  ```svelte
  연간 약 {opt.savingsVsSingleCard >= 0 && displayedAnnualSavings >= 100 ? '+' : ''}{formatWon(displayedAnnualSavings < 0 ? Math.abs(displayedAnnualSavings) : displayedAnnualSavings)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'} (최근 월 기준 단순 연환산)
  ```
- **Verification:** 
  - When `savingsVsSingleCard < 0`: annual line shows "연간 약 60,000원 추가 비용" (no redundant minus)
  - When `savingsVsSingleCard > 0` and annual >= 100: annual line shows "연간 약 +60,000원 절약"
  - When `savingsVsSingleCard > 0` and annual < 100: annual line shows "연간 약 50원 절약" (no `+`)
  - During animation transitions, no incorrect `+` prefix appears on the annual line
- **Status:** DONE

---

## Task 2: Fix SavingsComparison zero-width bars when both rewards are zero (C86-07)

- **Finding:** C86-07 (LOW, MEDIUM confidence)
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:125-136`
- **Problem:** When both `opt.totalReward === 0` and `opt.bestSingleCard.totalReward === 0`, both `singleBarWidth` and `cherrypickBarWidth` return 0. The comparison bars section renders with two zero-width bars, which looks broken to users.
- **Fix:** When both rewards are zero, hide the comparison bar section entirely (it provides no useful visual information). Add a guard in the template:
  ```svelte
  {#if opt.totalReward > 0 || opt.bestSingleCard.totalReward > 0}
    <!-- Visual bar comparison -->
    ...
  {/if}
  ```
- **Verification:** When both rewards are zero, the bar comparison section is hidden. When either reward is non-zero, bars render normally.
- **Status:** DONE

---

## Task 3: Improve CSV/XLSX header detection to require keyword category diversity (C86-03 / C86-05)

- **Finding:** C86-03 (LOW, MEDIUM) + C86-05 (LOW, MEDIUM)
- **Files:** `apps/web/src/lib/parser/csv.ts:149-171`, `apps/web/src/lib/parser/xlsx.ts:365-374`
- **Problem:** Both the generic CSV parser and the XLSX parser use a simple keyword match count to detect header rows. Two amount keywords (e.g., "이용금액" and "승인금액") can satisfy the threshold without any date or merchant keywords being present, causing summary table rows to be misidentified as headers.
- **Fix:** In the generic CSV parser, require that the header row contains keywords from at least 2 distinct categories (date, merchant, amount). In the XLSX parser, require matchCount >= 2 from at least 2 distinct keyword categories. Define keyword category sets:
  ```typescript
  const DATE_KEYWORDS = ['이용일', '이용일자', '거래일', '거래일시', '날짜', '일시', '결제일', '승인일', '매출일'];
  const MERCHANT_KEYWORDS = ['이용처', '가맹점', '가맹점명', '이용가맹점', '거래처', '매출처', '사용처', '결제처', '상호'];
  const AMOUNT_KEYWORDS = ['이용금액', '거래금액', '금액', '결제금액', '승인금액', '매출금액', '이용액'];
  ```
  Then check that at least 2 of these 3 categories have matches.
- **Verification:** A CSV with a summary row "이용금액, 승인금액" is NOT detected as a header. A CSV with "이용일, 가맹점명, 이용금액" IS detected as a header.
- **Status:** DONE

---

## Task 4: Add focus trap and Escape-to-close to mobile menu (C86-13) — FALSE POSITIVE

- **Finding:** C86-13 (LOW, MEDIUM confidence)
- **File:** `apps/web/src/layouts/Layout.astro:109-148` (mobile menu), and the associated `scripts/layout.js`
- **Problem:** The mobile slide-in menu lacks keyboard accessibility: no focus trap, no Escape key handler, no focus management. WCAG 2.2 SC 2.1.2 (No Keyboard Trap) and SC 2.4.3 (Focus Order) require these for modal-like overlays.
- **Fix:** Verified that `scripts/layout.js` already implements all three required features: focus trap (Tab/Shift+Tab wrapping), Escape key handler, and focus management (return focus to hamburger button on close). No changes needed.
- **Verification:** Code review confirms all keyboard accessibility features are present in layout.js.
- **Status:** DONE (false positive — already implemented)

---

## Task 5: Improve TransactionReview category select with optgroup (C86-08)

- **Finding:** C86-08 (LOW, MEDIUM confidence)
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:304-306`
- **Problem:** The category select dropdown renders all options as a flat list with leading-space indentation for subcategories. Some mobile browsers trim leading spaces, making subcategories visually indistinguishable from parent categories.
- **Fix:** Group subcategories under their parent using `<optgroup>`. Restructure `categoryOptions` into a grouped format and render with `<optgroup>`:
  ```svelte
  <select ...>
    {#each categoryGroups as group}
      <optgroup label={group.label}>
        {#each group.options as opt}
          <option value={opt.id}>{opt.label}</option>
        {/each}
      </optgroup>
    {/each}
  </select>
  ```
  Note: The top-level "uncategorized" option should remain outside any optgroup so it's always selectable.
- **Verification:** Category dropdown shows proper visual grouping with parent categories as optgroup labels. Works on both desktop and mobile browsers.
- **Status:** DONE

---

## Deferred Items

The following findings from this cycle are deferred per the repo's existing deferral conventions (LOW severity, carried forward from prior cycles, or requiring architectural changes that exceed this cycle's scope):

### C86-02: getCategoryColor gray fallback for unknown dot-notation keys
- **File+Line:** `CategoryBreakdown.svelte:91-96`
- **Severity/Confidence:** LOW / MEDIUM
- **Reason:** The current dot-notation coverage (added in C81-04) covers all 17 existing subcategories. New subcategories would need a corresponding CATEGORY_COLORS entry, which is a data maintenance concern, not a bug. The gray fallback is functional.
- **Exit criterion:** When a new subcategory is added to categories.yaml without a CATEGORY_COLORS entry, the build should warn or the color should auto-generate from the parent.

### C86-04: VisibilityToggle $effect directly mutates DOM
- **File+Line:** `VisibilityToggle.svelte:62-131`
- **Severity/Confidence:** LOW / HIGH
- **Reason:** Known architectural debt, 18+ cycles. Fix would require refactoring the results page stat elements to use Svelte bindings instead of imperative DOM access. Risk of breaking View Transitions integration. Already deferred per prior cycles.
- **Exit criterion:** When the results page is refactored to use Svelte-driven conditional rendering instead of VisibilityToggle's DOM manipulation.

### C86-06: PDF fallback date regex can match amount-like values
- **File+Line:** `pdf.ts:350`
- **Severity/Confidence:** LOW / LOW
- **Reason:** Already guarded by `isValidShortDate()` which validates month/day ranges. The false-positive rate is negligible.
- **Exit criterion:** If a real-world PDF statement is found where this regex incorrectly matches an amount as a date.

### C86-09: Report page doesn't show annual projection
- **File+Line:** `ReportContent.svelte:46-49`
- **Severity/Confidence:** LOW / LOW
- **Reason:** Feature gap, not a bug. The report is a static printable view; adding annual projection is a feature enhancement.
- **Exit criterion:** When a feature request is made for annual projection on the report page.

### C86-10: Bank list has 5 independent copies requiring manual synchronization
- **Files:** detect.ts, csv.ts, xlsx.ts, FileDropzone.svelte, formatters.ts
- **Severity/Confidence:** MEDIUM / HIGH
- **Reason:** Known architectural debt, 18+ cycles. Fix requires a shared bank registry module accessible from both browser and SSR contexts. Already deferred per prior cycles.
- **Exit criterion:** When the shared module architecture (D-01) is implemented.

### C86-11: cachedCategoryLabels/cachedCoreRules not invalidated on View Transitions
- **Files:** store.svelte.ts, analyzer.ts
- **Severity/Confidence:** MEDIUM / MEDIUM
- **Reason:** Known issue, 29+ cycles. The caches are intentionally preserved for performance across View Transitions. Invalidating on every transition would negate the performance benefit. The data is static within a session.
- **Exit criterion:** When the underlying data (cards.json, categories.json) can change within a session (e.g., live updates from the scraper).

### C86-12: MerchantMatcher substring scan O(n) per transaction
- **File+Line:** `taxonomy.ts:70-78`
- **Severity/Confidence:** MEDIUM / HIGH
- **Reason:** Known performance concern, 26+ cycles. For current data sizes (~500 keywords, ~1000 transactions) it's acceptable. Aho-Corasick would be the proper fix but is a significant algorithmic change.
- **Exit criterion:** When categorization takes more than 500ms for a typical statement, or when the keyword count exceeds 1000.

### C86-14: CATEGORY_COLORS dark mode contrast
- **File+Line:** `CategoryBreakdown.svelte:6-84`
- **Severity/Confidence:** LOW / HIGH
- **Reason:** Known issue, many cycles. Colors serve as bar fills, not text, so WCAG text contrast requirements technically don't apply. However, some colors (utilities gray, parking) are hard to distinguish in dark mode.
- **Exit criterion:** When a dark-mode-specific color palette is implemented for CATEGORY_COLORS.

### C86-15: CSP allows 'unsafe-inline' for script-src
- **File+Line:** `Layout.astro:42`
- **Severity/Confidence:** MEDIUM / HIGH
- **Reason:** Known constraint documented in the CSP comment. Required for Astro's Svelte island hydration. Fix requires nonce-based CSP which is a significant infrastructure change.
- **Exit criterion:** When Astro supports nonce-based CSP for Svelte island hydration scripts.

### C86-16: No integration test for multi-file upload
- **Severity/Confidence:** MEDIUM / MEDIUM
- **Reason:** Test infrastructure concern, not a code bug. The individual components are tested; the integration gap is known.
- **Exit criterion:** When a test infrastructure for multi-file upload integration tests is set up.

---

## Status of Prior Plans

All prior cycle plans (1-85) are DONE or archived. The cycle 85 plan tasks (C85-01, C85-02, C85-03) were marked DONE but verification shows C85-01 and C85-02 were NOT actually applied. This cycle's Task 1 will re-apply these fixes properly.
