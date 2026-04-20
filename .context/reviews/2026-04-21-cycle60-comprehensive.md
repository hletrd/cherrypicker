# Comprehensive Code Review -- Cycle 60

**Reviewer:** Full codebase review (cycle 60 of 100)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** eslint (no config -- N/A), tsc --noEmit (PASS), vitest (189 pass), bun test (57 pass)

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-59 reviews and the aggregate. Ran targeted pattern searches for: innerHTML/XSS vectors (none found), bare `catch {}` blocks (5 found, all in expected try/catch paths for sessionStorage/SSR), `any` type usage (2 occurrences in store.svelte.ts validated parsing paths, already flagged D-107), `window.location` full-page navigation (3 occurrences, 2 already deferred C19-04/C19-05), inline `onclick` handlers in Astro templates (2 found in results.astro and report.astro for `window.print()`). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-59 findings are confirmed fixed except as noted in the aggregate's OPEN items. Notably:

- C59-03 (VisibilityToggle savings label cleanup): **FIXED** -- `originalSavingsLabelText` now captured on first access and restored during cleanup (line 22, 102-104, 125)
- C59-02 (SpendingSummary monthDiff validation): **FIXED** -- `monthRe` regex validation added before parseInt calls (lines 124-130)

---

## New Findings

### C60-01: `CardGrid.svelte` filteredCards computed before availableIssuers, creating dependency cycle

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/cards/CardGrid.svelte:22,27-31`
- **Description:** Line 22 derives `availableIssuers` from `filteredCards`, but `filteredCards` at line 33 is a `$derived.by` that includes type filter, issuer filter, and search logic. The `$effect` at line 27 resets `issuerFilter` when the selected issuer is no longer in `availableIssuers` after a type filter change. However, `availableIssuers` depends on `filteredCards`, and `filteredCards` depends on `issuerFilter`. This creates a subtle reactive cycle: changing `typeFilter` -> recalculates `filteredCards` -> recalculates `availableIssuers` -> $effect may reset `issuerFilter` -> recalculates `filteredCards` again. In practice, Svelte 5's `$derived` and `$effect` schedulers handle this without infinite loops because the second pass stabilizes, but the double-computation is wasteful and the ordering dependency is fragile. If Svelte's scheduler changes, this could become a glitch.
- **Failure scenario:** User selects issuer "hyundai", then switches type filter to "check". The $effect fires, resets issuerFilter to "", which triggers filteredCards to recompute. The double computation is invisible to the user but wastes a render cycle.
- **Fix:** Derive `availableIssuers` from the raw `cards` array filtered by type only (not by issuer or search), so it doesn't depend on `filteredCards`:

```ts
let availableIssuers = $derived.by(() => {
  let filtered = cards.slice();
  if (typeFilter === 'credit') filtered = filtered.filter(c => c.type === 'credit');
  else if (typeFilter === 'check') filtered = filtered.filter(c => c.type === 'check');
  else if (typeFilter === 'prepaid') filtered = filtered.filter(c => c.type === 'prepaid');
  return [...new Set(filtered.map(c => c.issuer))].sort();
});
```

### C60-02: `report.astro` print stylesheet uses `:global()` selectors that may break under strict CSP

- **Severity:** LOW
- **Confidence:** LOW
- **File:** `apps/web/src/pages/report.astro:65-81`
- **Description:** The print stylesheet in report.astro uses `:global(nav)`, `:global(footer)`, `:global(main)`, and `:global(body)` selectors. These work correctly with Astro's scoped styles. However, the `body` selector override (`background: #fff !important; color: #000 !important;`) forces white background and black text for printing, which is correct for light mode but discards the user's dark mode print preference. Most browsers default to white backgrounds when printing regardless of screen mode, so this is typically harmless. The `!important` on all rules is aggressive but necessary to override Tailwind utility classes.
- **Failure scenario:** User in dark mode prints the report. The forced `background: #fff` and `color: #000` correctly ensure print readability, but any inline-styled elements with dark-specific colors (e.g., issuer badge backgrounds) still render in their dark-mode colors against the forced white background, potentially creating contrast issues.
- **Fix:** Consider adding `@media print { ... }` rules that also reset issuer badge colors and dark-mode-specific styles for print consistency. This is a minor visual polish issue.

### C60-03: `FileDropzone.svelte` uses `window.location.href` for navigation instead of Astro View Transitions

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:238`
- **Description:** After successful analysis, the component navigates to the dashboard using `window.location.href = buildPageUrl('dashboard')`. This causes a full page reload, losing client-side state and skipping Astro View Transitions. The same pattern is used in `CardDetail.svelte:267` for the "카드 목록으로 돌아가기" button. Both are already deferred as C19-04 and C19-05 respectively. However, the `FileDropzone` navigation is particularly impactful because it occurs after the user has just uploaded and analyzed data -- the full reload means the store's in-memory state is lost and must be restored from sessionStorage, adding a noticeable delay. Using Astro's `navigate()` function (from `astro:transitions`) would preserve the store state and provide a smoother transition.
- **Failure scenario:** User uploads a large statement, analysis completes, full page reload causes ~500ms blank screen while sessionStorage data is re-parsed and restored.
- **Fix:** Use Astro's client-side navigation API instead of `window.location.href`. This requires importing `navigate` from `astro:transitions` (or using the document's `astro:after-swap` event pattern). Note: this is already deferred as C19-04/C19-05 -- confirming it is still open.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C60-01 | LOW | MEDIUM | `CardGrid.svelte:22,27-31` | `availableIssuers` derived from `filteredCards` creates reactive dependency cycle with `$effect` that resets `issuerFilter` | NEW |
| C60-02 | LOW | LOW | `report.astro:65-81` | Print stylesheet forces light-mode colors but doesn't reset dark-mode-specific inline styles (issuer badges, etc.) | NEW |
| C60-03 | LOW | HIGH | `FileDropzone.svelte:238` | Already deferred as C19-04 -- `window.location.href` causes full reload instead of Astro View Transition | CONFIRMED STILL OPEN |

---

## Gate Results

| Gate | Result |
|---|---|
| eslint | No config found -- N/A |
| tsc -p apps/web/tsconfig.json --noEmit | PASS (0 errors) |
| vitest run | PASS (189 tests, 8 files) |
| bun test (packages/parser) | PASS (57 tests, 3 files) |
