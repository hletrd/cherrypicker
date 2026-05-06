# Cycle 33 UI/UX Review — CherryPicker

**Agent:** c33-designer  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: Mobile menu lacks focus trap and Escape key handling [MEDIUM / High confidence]

**File:** `apps/web/src/layouts/Layout.astro:130-156`

**Problem:** The mobile slide-in menu (`#mobile-menu`) toggles visibility but:
1. Does not trap focus inside the menu when open
2. Does not close on Escape key press
3. Does not restore focus to the hamburger button when closed

**Failure scenario:** A keyboard user opens the mobile menu, tabs through nav links, and tabs past the menu without it closing. Focus moves to page content behind the menu.

**Suggested fix:** Add JavaScript focus trap and Escape handler in `layout.js`.

**Confidence:** High

---

## Finding 2: File dropzone may not announce errors to screen readers [LOW / Medium confidence]

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Problem:** Need to verify if parse errors are announced via ARIA live regions. If a user uploads an invalid file, the error may only appear visually.

**Suggested fix:** Add `aria-live="polite"` region for parse error announcements.

**Confidence:** Medium

---

## Finding 3: Dark mode toggle lacks `aria-pressed` state [LOW / Medium confidence]

**File:** `apps/web/src/layouts/Layout.astro:89-100`

**Problem:** The theme toggle button has `aria-label="테마 전환"` but no `aria-pressed` to indicate current state. Screen reader users cannot tell if dark mode is active.

**Suggested fix:** Add `aria-pressed` attribute synchronized with the current theme.

**Confidence:** Medium

---

## Finding 4: C32 UI fixes verified present [VERIFIED / High confidence]

- KB badge dark text: `formatters.ts` updated
- Rate bar height: `OptimalCardMap.svelte` uses thicker bars
- Step connector: `FileDropzone.svelte` uses thicker lines

**Confidence:** High

---

## Final Sweep

- Skip link present and functional (Layout.astro:57-59).
- Semantic HTML used throughout.
- No color contrast issues detected beyond those fixed in C32.
- Responsive breakpoints appear appropriate.
