# QA Test Plan — CherryPicker (Cycle 32)

**Reviewer:** qa-tester (self-completed after agent timeout)
**Scope:** Manual validation, runtime checks, cross-browser and performance scenarios
**Date:** 2026-05-06

---

## Summary

Seven manual test scenarios derived from code-review findings. Three are data-integrity critical, two are compatibility checks, two are UX/resilience checks.

---

## Manual Test Scenarios

### QA-01: UTF-16 LE CSV Upload (Compatibility)

**Prerequisite:** Obtain or synthesize a UTF-16 LE CSV from a Korean bank export.
**Steps:**
1. Open the CherryPicker web app.
2. Upload the UTF-16 LE CSV via FileDropzone.
3. Observe encoding detection warning and parsed merchant names.

**Expected:** Merchant names display correctly (e.g., "현대카드"). No replacement characters.
**Actual (current):** Web-side `parseFile` only tries utf-8/cp949. Expect corruption or fallback warning.
**Severity:** Medium — blocks users with older bank exports.

---

### QA-02: XLSX Multi-Section Upload with Blank Rows (Data Integrity)

**Prerequisite:** Create an XLSX with two data sections separated by blank rows. Section A ends with merchant="스타벅스", amount=5000. Section B starts with a merged/empty merchant cell.

**Steps:**
1. Upload the XLSX.
2. Check the first transaction of Section B.

**Expected:** Merchant should be the actual value from Section B (or empty if genuinely merged).
**Actual (current):** Forward-fill from Section A leaks in — merchant shows "스타벅스".
**Severity:** High — silent data corruption.

---

### QA-03: 1000+ Transaction Performance Check (Performance)

**Prerequisite:** Generate a CSV with 1500 transactions.
**Steps:**
1. Upload the file.
2. Click "Analyze".
3. Measure time from click to result display.

**Expected:** Under 3 seconds on modern desktop; under 5 seconds on mid-range mobile.
**Actual (current):** Greedy optimizer is O(T²·C). With 100 cards, could exceed 10 seconds and cause browser "page unresponsive" warning.
**Severity:** Medium — UX degradation at scale.

---

### QA-04: sessionStorage QuotaExceededError Resilience (Resilience)

**Prerequisite:** Use browser dev-tools to set sessionStorage quota to near-zero, or open in Safari private mode.
**Steps:**
1. Upload and analyze a file.
2. Dismiss any warning banner.
3. Refresh the page.

**Expected:** App gracefully handles missing persistence. No uncaught exceptions.
**Actual (current):** `store.svelte.ts` wraps sessionStorage in try/catch and silently drops persistence. The SpendingSummary banner handles QuotaExceededError. Generally resilient.
**Severity:** Low — already handled, but worth regression-testing.

---

### QA-05: Mobile Responsiveness — 375px Width (UX)

**Prerequisite:** Use Chrome DevTools device emulation (iPhone SE).
**Steps:**
1. Navigate to Dashboard.
2. Scroll through TransactionReview, CategoryBreakdown, OptimalCardMap.

**Expected:** No horizontal scroll. Tap targets >= 44px. Text readable without zoom.
**Actual (current):** Svelte components use Tailwind responsive classes. Likely acceptable, but FileDropzone drop zone may be small on narrow screens.
**Severity:** Low — cosmetic.

---

### QA-06: Keyboard Navigation in TransactionReview Modal (Accessibility)

**Prerequisite:** Use only keyboard (Tab, Shift+Tab, Enter, Escape).
**Steps:**
1. Open TransactionReview.
2. Tab to category dropdown, change category.
3. Tab to save, press Enter.
4. Press Escape to close modal.

**Expected:** Focus is trapped inside modal while open. Focus returns to trigger button on close. ARIA roles and labels are present.
**Actual (current):** Not verified — needs manual check.
**Severity:** Medium — accessibility compliance gap.

---

### QA-07: Cross-Month Edit → Reoptimize Staleness (Data Integrity)

**Prerequisite:** Analyze January data with previousMonthSpending manually set to 500000.
**Steps:**
1. Wait several minutes (or simulate time passage).
2. Edit a December transaction category.
3. Click Reoptimize.

**Expected:** Previous month spending is recomputed from edited December transactions.
**Actual (current):** `store.svelte.ts` caches `previousMonthSpendingOption`. If the cached value is older than the most recent edit to previous-month transactions, the optimizer uses stale baseline.
**Severity:** Medium — incorrect performance tier calculation.

---

## Verdict

**RUN FIRST:** QA-02 (XLSX blank rows) and QA-07 (cross-month staleness) — data integrity.
**RUN NEXT:** QA-01 (UTF-16), QA-03 (performance), QA-06 (accessibility).
**RUN LAST:** QA-04 (resilience), QA-05 (responsive).
