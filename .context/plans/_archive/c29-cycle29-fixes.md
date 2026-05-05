# Cycle 29 Implementation Plan

**Date:** 2026-04-22
**Cycle:** 29/100

## New Actionable Findings This Cycle

### MEDIUM Priority

| ID | File | Description | Action |
|---|---|---|---|
| C29-01 | `CategoryBreakdown.svelte:38-41` | CATEGORY_COLORS utility subcategories (electricity/gas/water) nearly invisible in dark mode -- WCAG AA failure | Replace gray utility colors with higher-contrast alternatives |

### LOW Priority

| ID | File | Description | Action |
|---|---|---|---|
| C29-02 | `CardDetail.svelte:225-226` | Performance tier header uses CSS variable bg with hardcoded Tailwind text colors -- dark mode contrast inconsistent | Replace `bg-[var(--color-primary-light)]` with explicit `bg-blue-50 dark:bg-blue-900/50`, adjust text colors for consistency |
| C29-03 | `csv.ts:880-891` | CSV adapter registry only covers 10 of 24 banks -- digital-only banks fall through to generic parser (same as C22-04) | Deferred -- requires bank-specific adapter implementations |

## Implementation Steps

### Step 1: Fix CATEGORY_COLORS dark mode contrast for utility subcategories (C29-01) -- DONE

- File: `apps/web/src/components/dashboard/CategoryBreakdown.svelte`
- Change: Replace gray utility colors with high-contrast alternatives
  - `electricity: '#9ca3af'` -> `'#facc15'` (yellow-400, ~7.5:1 contrast on dark)
  - `gas: '#94a3b8'` -> `'#fb923c'` (orange-400, ~5.2:1 contrast on dark)
  - `water: '#64748b'` -> `'#38bdf8'` (sky-400, ~6.1:1 contrast on dark)
  - `insurance: '#64748b'` -> `'#a78bfa'` (violet-400, ~5.8:1 on dark)

### Step 2: Fix CardDetail performance tier header dark mode contrast (C29-02) -- DONE

- File: `apps/web/src/components/cards/CardDetail.svelte`
- Change: Replace `bg-[var(--color-primary-light)]` with explicit `bg-blue-50 dark:bg-blue-900/50`
- Change: Adjust text color from `text-blue-700 dark:text-blue-200` to `text-blue-700 dark:text-blue-300` for better contrast

### Step 3: Run quality gates -- DONE

- Lint: `bun run lint` -- 0 errors, 0 warnings
- Typecheck: `bun run typecheck` -- 0 errors, 0 warnings
- Tests: `bun test` -- 266 pass, 0 fail
- Build: `bun run build` -- success, 5 pages built

## Deferred Items

| ID | Severity | Reason | Exit Criterion |
|---|---|---|---|
| C29-03 | LOW | CSV adapter gap for 14 banks; requires bank-specific adapter implementations (same as C22-04) | When bank adapters are added for remaining banks |
| C7-04 | LOW | TransactionReview $effect pattern fragile but functional; re-architecting requires Svelte 5 best practices research | When Svelte 5 provides a better DOM-synchronization pattern |
| C7-06 | LOW | analyzeMultipleFiles optimizes only latest month by design | When the optimizer supports multi-month optimization |
| C7-07 | LOW | BANK_SIGNATURES duplication between packages/parser and apps/web | When a shared parser-utils package is created |
| C7-11 | LOW | persistWarning message could be more specific | When a Korean UX review is done |
| C8-07/C4-14 | LOW | build-stats.ts fallback values drift | When Astro build hooks inject real stats |
| C8-08 | LOW | inferYear() timezone edge case | When a timezone-agnostic date library is adopted |
| C8-09 | LOW | Test duplicates production code | When test utilities are extracted into a shared test helper |
| C18-01 | MEDIUM | VisibilityToggle $effect DOM mutation | When Astro View Transitions are adopted or Svelte provides a better pattern |
| C18-03 | LOW | Annual savings projection lacks seasonal adjustment | When multi-month data is available for seasonal analysis |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks first 512 bytes | When a streaming HTML detector is implemented |
| C19-04/C19-05 | LOW | Navigation uses full page reload | When Astro ClientRouter is adopted |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS divergence risk | When a shared pattern registry is created |
| C20-04/C25-10 | LOW | pdf.ts regex constants divergence risk | When a shared pattern registry is created |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race | When a ref-counted cache with abort coordination is implemented |
| C21-04/C23-02/C25-02/C26-03 | LOW->MEDIUM | cachedCategoryLabels/cachedCoreRules stale across long-lived tabs | When visibilitychange-based cache invalidation is implemented |
| C22-05/C25-11 | LOW | TransactionReview changeCategory O(n) | When performance profiling shows this is a bottleneck |
| C24-06/C25-04 | LOW | buildCardResults totalSpending no negative guard | When the optimizer supports negative amounts |
| C27-01 | MEDIUM | Bare catch {} in loadFromStorage inner cleanup | When a consistent error-logging pattern is adopted |
