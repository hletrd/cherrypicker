# UI/UX Review — Cycle 2 (2026-04-19)

Reviewer: designer angle (web UI present: Astro 6 + Svelte 5 + Tailwind CSS 4)

---

## Finding C2-U01: Transaction review table has no virtualization for large datasets

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:236-295`
**Severity:** MEDIUM
**Confidence:** High

The transaction table renders all transactions in the DOM with `max-h-[400px] overflow-y-auto`. For users with 500+ transactions, this creates a large DOM tree that can cause sluggish scrolling and high memory usage.

**Fix:** Implement virtual scrolling (e.g., using `svelte-virtual-list` or a custom solution) to only render visible rows.

---

## Finding C2-U02: Category dropdown has no optgroup for subcategories

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:267-270`
**Severity:** LOW
**Confidence:** Medium

Subcategories are displayed with leading spaces (`  ${sub.labelKo}`) instead of using `<optgroup>` or indentation via CSS. Screen readers won't convey the parent-child relationship, and the visual hierarchy is fragile (depends on font's space rendering).

**Fix:** Use `<optgroup label={parentCategory.labelKo}>` for subcategories, or use CSS `padding-left` with a dash prefix.

---

## Finding C2-U03: Mobile menu uses `inert` attribute but doesn't remove it when opened

**File:** `apps/web/src/layouts/Layout.astro:133`
**Severity:** MEDIUM
**Confidence:** High

The mobile menu div has `inert` attribute which prevents all user interaction and removes it from the accessibility tree. The JavaScript in `layout.js` is expected to toggle this attribute when the menu opens/closes. If the JS fails to load or execute, the menu will never be accessible.

This is an accessibility concern because the `inert` attribute is a strong guard — if the toggle logic has any bug, the menu becomes completely unusable for keyboard and screen reader users.

**Fix:** Ensure the menu JS has a fallback or remove `inert` from the initial HTML and add it dynamically when the menu is closed.

---

## Finding C2-U04: Dark mode toggle doesn't respect `prefers-color-scheme` on first visit

**File:** `apps/web/src/layouts/Layout.astro` + `public/scripts/layout.js`
**Severity:** LOW
**Confidence:** Medium

The dark mode toggle requires JS to detect and apply the user's system preference. If JS is slow to load or fails, the user sees the default light theme even if their OS is set to dark mode. A flash of wrong theme (FOWT) can occur.

**Fix:** Add an inline `<script>` in the `<head>` that checks `localStorage` or `prefers-color-scheme` and applies the `dark` class before the body renders. This is a common pattern:

```html
<script is:inline>
  (function() {
    var theme = localStorage.getItem('cherrypicker:theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

---

## Finding C2-U05: Focus trap not implemented for mobile menu

**File:** `apps/web/src/layouts/Layout.astro:129-156`
**Severity:** MEDIUM
**Confidence:** High

When the mobile menu is open, keyboard users can tab out of the menu to elements behind it. This violates WCAG 2.2 focus management requirements. A focus trap should keep focus within the menu while it's open.

**Fix:** Implement a focus trap that:
1. Moves focus to the first menu item when the menu opens
2. Traps Tab/Shift+Tab within the menu
3. Returns focus to the toggle button when the menu closes

---

## Finding C2-U06: Select dropdowns in transaction review lack keyboard-only navigation pattern

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:260-270`
**Severity:** LOW
**Confidence:** Medium

The category `<select>` elements are natively keyboard-accessible (native HTML select), but they don't indicate the current selection state in an accessible way when navigating with arrow keys. The `aria-label` is set to `{tx.merchant + " 카테고리"}` which is good, but there's no `aria-live` region to announce when a category is changed.

This is a minor accessibility gap — native `<select>` elements have reasonable built-in accessibility.

---

## Finding C2-U07: Skip link exists but could be more prominent

**File:** `apps/web/src/layouts/Layout.astro:56-58`
**Severity:** LOW
**Confidence:** Low

The skip link "본문으로 건너뛰기" uses `sr-only focus:not-sr-only` which is correct. When focused, it appears at the top-left corner. This is fine but could be improved by centering it for better visibility.

**Status:** Minor enhancement, not a bug.
