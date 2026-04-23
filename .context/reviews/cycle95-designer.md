# Cycle 95 — designer (UI/UX)

## Scope

Dashboard (SpendingSummary, SavingsComparison, CategoryBreakdown, OptimalCardMap, TransactionReview), upload flow (FileDropzone), cards directory, report page, layout.

## Accessibility Review (WCAG 2.2)

- `OptimalCardMap` rows have `role="button"`, `tabindex="0"`, `aria-label`, `aria-expanded`, and keyboard handlers (Enter/Space).
- `CategoryBreakdown` rows same pattern + `focus:ring-2`.
- `TransactionReview` select has `aria-label` with merchant name prefix.
- Icon-only close button in SpendingSummary is a `<button>` with text content "닫기".
- `getIssuerTextColor` maps kakao/jeju to dark text for contrast (C1-03 / C90-02).

## Responsive Behavior

- Dashboard grid: `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`.
- SavingsComparison: `grid gap-5 md:grid-cols-3`.
- OptimalCardMap: `overflow-x-auto` for narrow viewports.

## Animations / Motion

- SavingsComparison count-up respects `prefers-reduced-motion`.
- Category bars: `transition-all duration-700 ease-out`.
- Rate bars: `transition-all duration-500`.

## States

- Loading: animated-pulse skeletons on every dashboard card.
- Empty: dedicated empty-state CTA with icon + link to upload.
- Error: `persistWarningKind`-specific messages (truncated / corrupted / error).

## Known Deferred Design Items

- D-40 / D-82 annual *12 projection label.
- D-42 / D-46 / D-64 CategoryBreakdown color map coverage.
- D-70 / D-74 zero-savings / zero-reward comparison UX.
- D-101 SavingsComparison count-up flicker on rapid reoptimize.
- D-39 cards loading skeleton.

## New Findings

None.

## Summary

0 new findings. Accessible, responsive, motion-respectful UI maintained.
