# Cycle 16 — Designer/UI-UX Review

**Date:** 2026-05-06
**Scope:** UI/UX, accessibility, responsive design

## Findings

### C16-UI01 [LOW] — Transaction list doesn't visually distinguish refunds from purchases
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte` (inferred)
- **Issue:** If refunds are displayed (after C16-01 fix), they will appear alongside regular transactions without visual distinction. Users may not recognize negative amounts as refunds.
- **Impact:** Users could misinterpret refunds as purchases or vice versa.
- **Fix:** Add a visual indicator (color, icon, or label) for negative-amount transactions in the transaction review list.
- **Confidence:** Medium

### C16-UI02 [LOW] — SpendingSummary warning dismiss button lacks accessible name
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:159`
- **Issue:** The dismiss button contains only the text "닫기" with no additional ARIA attributes. Screen readers will read "닫기" which is adequate in Korean, but the button's purpose (dismiss data-loss warning) is not fully conveyed.
- **Impact:** Minor accessibility gap.
- **Fix:** Add `aria-label="데이터 손실 경고 닫기"` or similar descriptive label.
- **Confidence:** Low

### C16-UI03 [LOW] — FileDropzone accepts HTML files without distinguishing bank vs non-bank HTML
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:97-106`
- **Issue:** HTML is in the accepted types list. Users might upload arbitrary HTML files expecting parsing. The error message when parsing fails doesn't specifically mention "bank statement HTML required."
- **Impact:** UX confusion.
- **Fix:** Add a specific parse error for HTML files that don't match expected bank table structures.
- **Confidence:** Low

## Summary
Three LOW UI/UX findings. No accessibility blockers. The most impactful would be visual distinction for refunds once C16-01 is fixed.
