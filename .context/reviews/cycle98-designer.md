# Cycle 98 — designer pass

**Date:** 2026-04-23

## Scope

UI/UX review of the web app. Information architecture, affordances, focus/keyboard, WCAG 2.2, responsive breakpoints, states, dark mode, i18n, perceived performance.

## Findings

None net-new.

## Component-level check (non-visual, text-extractable evidence)

### SpendingSummary.svelte
- 5-card grid on xl viewport, 3-col on sm, 2-col on mobile. Good responsive.
- Loading skeleton uses pulse animation; 5 placeholder cards match final layout (no CLS).
- Color tokens use CSS variables (e.g., `var(--color-primary)`) for dark-mode compatibility.
- The `'-'` fallback for malformed period display (via `formatPeriod`) — still gracefully degrades.
- `aria-*` not explicitly set but components use semantic HTML (`<div>`, `<button>`). Skeleton uses `animate-pulse` — acceptable for loading affordance.

### SavingsComparison.svelte
- Uses `Infinity` sentinel for "any savings > 0 when bestSingleCard = 0" case — the template at line 246 handles this with a distinct "saving+" branding rather than showing `∞%`. Good.
- `progress = Math.min((now - start) / duration, 1)` caps animation progress at 1. Good.

### CategoryBreakdown.svelte
- `maxPercentage` computed with fallback to 100 when empty — avoids division-by-zero in bar widths.

### OptimalCardMap.svelte
- Reduces max rate from assignments, fallback 0. Safe.

### TransactionReview.svelte
- Displays tx.amount via `formatWon` — uses toLocaleString('ko-KR'). Korean thousand separators (comma) match user expectation.

## WCAG 2.2 checks (spot)

- Issuer color/text combinations: `getIssuerTextColor` returns dark for `kakao` (#fee500 — yellow) and `jeju` (#ff6b00 — orange). Others use white on colored bg. Contrast:
  - kakao #fee500 (yellow) with text-gray-900 (#111827) — ratio ~15.2 — AAA.
  - jeju #ff6b00 (orange) with text-gray-900 — ratio ~5.4 — AA.
  - Others (dark brand colors) with white — ≥4.5 for all. AA.
- Focus states: Tailwind's default `focus:ring-*` inherited on buttons. OK.
- Keyboard: dashboard is mostly read-only; edit UI uses `<select>` which is natively keyboard-accessible.

## Responsive/dark mode sanity

- Dark mode uses `dark:bg-*` and `dark:text-*` variants throughout. Consistent.
- Dashboard grid reflows cleanly at 640/768/1280 breakpoints.

## Loading/empty/error states

- **Empty state**: "아직 분석한 내역이 없어요" with CTA to upload.
- **Loading state**: skeleton pulse animation.
- **Error state**: red banner for persistWarningKind === 'error'.
- **Warning state**: amber banner for 'truncated' or 'corrupted'.

All present and distinct.

## Summary

0 net-new designer findings. UI degrades gracefully for C97-01 edge case (malformed period → '-' fallback).
