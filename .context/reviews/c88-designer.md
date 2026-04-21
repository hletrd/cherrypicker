# Designer — Cycle 88

## Summary
UI/UX review of the Astro 6 + Svelte 5 + Tailwind CSS 4 web app.

## Findings

### C88-11: Mobile menu lacks focus trap and Escape-to-close (LOW, HIGH)
**File:** `apps/web/src/layouts/Layout.astro:121-148`
**Problem:** Carry-forward from C86-13. The mobile slide-in menu (`#mobile-menu`) is toggled via `#mobile-menu-btn` but has no focus trap. When opened, Tab key navigation can escape to elements behind the menu. Escape key does not close the menu.
**WCAG 2.2:** 2.1.2 No Keyboard Trap (reverse -- focus CAN escape, which is the problem for modal-like overlays), 2.4.3 Focus Order.
**Fix:** Add focus trap (trap focus within menu when open) and Escape key handler. Use `role="dialog"` and `aria-modal="true"`.

### C88-12: Skip-to-content link works but could be more discoverable (LOW, LOW)
**File:** `apps/web/src/layouts/Layout.astro:49-51`
**Problem:** The skip link ("본문으로 건너뛰기") uses `sr-only focus:not-sr-only` pattern which is standard and correct. No issue, just noting it exists.

### C88-13: Dark mode color contrast for CATEGORY_COLORS (LOW, MEDIUM)
**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84`
**Problem:** Carry-forward from C4-10/C8-05/C8-09. Several CATEGORY_COLORS entries have poor contrast in dark mode. For example, `utilities: '#6b7280'` (gray-500) on dark backgrounds fails WCAG AA contrast ratio. The `cafe: '#92400e'` (amber-900) is also very dark. This is a known long-standing issue.

### C88-14: Loading skeleton uses light-mode-only colors (LOW, LOW)
**File:** Multiple components (SavingsComparison, CategoryBreakdown, etc.)
**Problem:** Loading skeleton placeholders use `bg-gray-200` and `bg-gray-300` which are light-mode specific. In dark mode these will appear too bright. Not a functional issue since the loading state is brief.

### C88-15: Step indicator uses role="progressbar" semantically (LOW, LOW)
**File:** `apps/web/src/components/upload/FileDropzone.svelte:278`
**Problem:** The step indicator uses `role="progressbar"` which is technically a progress bar, not a step indicator. `aria-valuenow={currentStep}` works but a stepper pattern with `role="list"` + `role="listitem"` would be more semantically correct. Not a functional issue.

### Verified UI/UX Controls
1. **Keyboard navigation**: All interactive elements (buttons, selects, table rows) have `tabindex="0"` and `onkeydown` handlers for Enter/Space.
2. **ARIA labels**: Category dropdowns have `aria-label`, transaction rows have accessible labels.
3. **Reduced motion**: SavingsComparison animation respects `prefers-reduced-motion`.
4. **Responsive design**: Grid layouts use `md:` breakpoints properly. Mobile-specific UI for nav and bank selector.
5. **Empty states**: All dashboard components have empty state placeholders with helpful CTAs.
