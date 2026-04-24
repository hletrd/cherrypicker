# Cycle 10 — Designer

Date: 2026-04-24

## UI/UX review — web frontend

The repo contains a Svelte 5 web frontend with interactive dashboard components, making a UI/UX review applicable.

## Inventory of UI components reviewed

- `apps/web/src/components/dashboard/CategoryBreakdown.svelte` (293 lines)
- `apps/web/src/components/dashboard/SavingsComparison.svelte` (330 lines)
- `apps/web/src/components/dashboard/SpendingSummary.svelte` (189 lines)
- `apps/web/src/components/dashboard/TransactionReview.svelte` (345 lines)
- `apps/web/src/components/dashboard/OptimalCardMap.svelte` (185 lines)
- `apps/web/src/components/upload/FileDropzone.svelte` (558 lines)
- `apps/web/src/components/cards/CardDetail.svelte` (303 lines)
- `apps/web/src/components/cards/CardGrid.svelte` (reviewed via prior cycles)
- `apps/web/src/components/ui/VisibilityToggle.svelte` (126 lines)

## Accessibility review

### WCAG 2.2 compliance
- **scope="col"** on all table headers — PASS (C4-01 fix intact)
- **aria-label** on interactive elements (buttons, selects, inputs) — PASS
- **aria-expanded** on expandable rows (CategoryBreakdown, TransactionReview) — PASS
- **aria-busy** on upload form during uploading — PASS (C8-03 fix intact)
- **aria-pressed** on bank selector pills — PASS
- **role="alert"** on error banner — PASS
- **role="group"** with aria-label on bank selector — PASS

### Keyboard navigation
- All interactive elements are focusable (tabindex on expandable rows)
- Enter/Space handlers on expandable rows (CategoryBreakdown, OptimalCardMap)
- Focus ring styles (`focus:ring-2 focus:ring-[var(--color-primary)]`) present

### Color contrast
- Text on colored backgrounds verified in prior cycles (C6UI-22, C6UI-31)
- Dark mode variants provided for most text colors
- `getIssuerTextColor` returns dark text for light issuer backgrounds (kakao, jeju)

### Known accessibility gaps (already tracked)
- D7-M8: No axe-core WCAG regression gate
- D8-01: No prefers-reduced-motion rule for spinner
- D8-02: Dashboard cards lack role="region" + aria-labelledby
- C6UI-04/C6UI-05: WCAG 1.4.11 non-text contrast
- C6UI-23: Target size below 44x44 (WCAG AAA)

## Visual design review

### Loading states
- All dashboard components show skeleton loading states during `analysisStore.loading`
- FileDropzone shows step indicator with visual progress

### Empty states
- All components show "아직 ... 없어요" empty states with CTA link to upload page

### Error states
- FileDropzone error banner with role="alert" and "다시 시도" button
- CardDetail error state for failed fetch

### Responsive design
- Grid layouts use responsive breakpoints (sm:, md:, xl:)
- Table overflow-x-auto for narrow viewports
- FileDropzone bank selector wraps with flex-wrap

## Findings

None net-new. All UI/UX findings from prior cycles are tracked in deferred items.

## Conclusion

Zero net-new UI/UX findings. The application has proper loading, empty, and error states. Accessibility attributes are in place. Known gaps (axe-core gate, reduced motion, region roles) are tracked.
