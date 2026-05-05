# Cycle 28 Implementation Plan

**Date:** 2026-04-22
**Cycle:** 28/100

## New Actionable Findings This Cycle

### LOW Priority

| ID | File | Description | Action |
|---|---|---|---|
| C28-01 | `VisibilityToggle.svelte:13` | Duplicated `formatWonStat()` diverges from `formatters.ts:formatWon()` -- missing -0 normalization | Replace `formatWonStat` with imported `formatWon` from formatters.ts |
| C28-02 | `xlsx.ts:386-395` | XLSX parser does not filter zero-amount rows, inconsistent with CSV/PDF parsers | Add `if (amount === 0) continue;` after null check |

### Carried Forward (C27 findings, still actionable)

| ID | File | Description | Action |
|---|---|---|---|
| C27-01 | `store.svelte.ts:253` | Bare `catch {}` in loadFromStorage inner cleanup | Add explanatory comment inside inner catch (already has comment per cycle 27 review -- re-verify) |
| C27-02 | `csv.ts:187-193` | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() | Replace inline checks with `isValidAmount()` call |

## Implementation Steps

### Step 1: Fix VisibilityToggle formatWonStat divergence (C28-01) -- DONE

- File: `apps/web/src/components/ui/VisibilityToggle.svelte`
- Change: Removed the local `formatWonStat()` function and replaced calls with imported `formatWon` from `../../lib/formatters.js`
- Commit: `00000002f0618d4d746f3eb9e83d35453c284390`

### Step 2: Add zero-amount filter to XLSX parser (C28-02) -- DONE

- File: `apps/web/src/lib/parser/xlsx.ts`
- Change: Added `if (amount === 0) continue;` after null check with explanatory comment
- Commit: `0000000b4204982102e00a924d400199b296ee29`

### Step 3: Verify C27-01 inner catch comment -- DONE (already fixed)

- File: `apps/web/src/lib/store.svelte.ts`
- Status: The comment was already present on line 253: `catch { /* best-effort cleanup: corrupted data removal, SecurityError in sandboxed iframes is expected */ }`. No change needed.

### Step 4: Unify parseGenericCSV amount validation (C27-02) -- DONE (already fixed)

- File: `apps/web/src/lib/parser/csv.ts`
- Status: The code already uses `isValidAmount()` on line 189. The C27-02 fix was applied in a prior cycle. No change needed.

### Step 5: Run quality gates -- DONE

- Lint: `bun run lint` -- 0 errors, 0 warnings
- Typecheck: `bun run typecheck` -- 0 errors, 0 warnings
- Tests: `bun test` -- 266 pass, 0 fail
- Build: `bun run build` -- success, 5 pages built

## Deferred Items

The following findings from this cycle are deferred per repo rules:

| ID | Severity | Reason | Exit Criterion |
|---|---|---|---|
| C7-04 | LOW | TransactionReview $effect pattern fragile but functional; re-architecting requires Svelte 5 best practices research | When Svelte 5 provides a better DOM-synchronization pattern, or when the component is rewritten |
| C7-06 | LOW | analyzeMultipleFiles optimizes only latest month by design; changing this requires optimizer changes | When the optimizer supports multi-month optimization |
| C7-07 | LOW | BANK_SIGNATURES duplication between packages/parser and apps/web; requires shared package re-architecture | When a shared parser-utils package is created |
| C7-11 | LOW | persistWarning message could be more specific; low impact, user-facing text change | When a Korean UX review is done |
| C8-05/C4-09/C25-01 | MEDIUM | CATEGORY_COLORS dark mode contrast requires design system changes | When design tokens are implemented with dark mode variants |
| C8-07/C4-14 | LOW | build-stats.ts fallback values drift; requires build-time stats injection | When Astro build hooks inject real stats |
| C8-08 | LOW | inferYear() timezone edge case; narrow window (minutes around midnight, once per year) | When a timezone-agnostic date library is adopted |
| C8-09 | LOW | Test duplicates production code; requires test re-architecture | When test utilities are extracted into a shared test helper |
| C18-01 | MEDIUM | VisibilityToggle $effect DOM mutation; re-architecting requires Svelte/Astro View Transition research | When Astro View Transitions are adopted or Svelte provides a better pattern |
| C18-03 | LOW | Annual savings projection lacks seasonal adjustment; qualifier text is present | When multi-month data is available for seasonal analysis |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks first 512 bytes; rare edge case | When a streaming HTML detector is implemented |
| C19-04/C19-05 | LOW | Navigation uses full page reload; requires Astro ClientRouter | When Astro View Transitions / ClientRouter is adopted |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS divergence risk with date-utils.ts; documented with NOTE comment | When a shared pattern registry is created |
| C20-04/C25-10 | LOW | pdf.ts regex constants divergence risk with date-utils.ts; documented with NOTE comment | When a shared pattern registry is created |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race; complex to fix without breaking API | When a ref-counted cache with abort coordination is implemented |
| C21-04/C23-02/C25-02/C26-03 | LOW->MEDIUM | cachedCategoryLabels/cachedCoreRules stale across long-lived tabs; requires session lifecycle hooks | When a visibilitychange-based cache invalidation is implemented |
| C22-04 | LOW | CSV adapter gap for 14 banks; requires bank-specific adapter implementations | When bank adapters are added for remaining banks |
| C22-05/C25-11 | LOW | TransactionReview changeCategory O(n) array copy; premature optimization for typical dataset sizes | When performance profiling shows this is a bottleneck |
| C24-06/C25-04 | LOW | buildCardResults totalSpending no negative guard; safe in practice (optimizer filters negative amounts) | When the optimizer supports negative amounts |
| C25-09/C53-03 | MEDIUM | CardDetail performance tier header dark mode contrast; requires design token changes | When design tokens are implemented with dark mode variants |
| C27-01 | MEDIUM | Bare catch {} in loadFromStorage inner cleanup; now has comment | When a consistent error-logging pattern is adopted across all catch blocks |
