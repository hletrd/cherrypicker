# Cycle 25 Implementation Plan

**Date:** 2026-04-20
**Cycle:** 25/100

## New Actionable Findings This Cycle

### MEDIUM Priority

| ID | File | Description | Action |
|---|---|---|---|
| C25-01/C8-05 | `CategoryBreakdown.svelte` | CATEGORY_COLORS `water` (#1f2937) and `gas` (#374151) nearly invisible in dark mode | Replace dark-mode-invisible colors with lighter alternatives that maintain hue |
| C25-06/D-106 | `pdf.ts:260` | Bare `catch {}` in tryStructuredParse silently swallows failures | Add `console.warn` with error details before returning null |
| C25-09/C53-03 | `CardDetail.svelte:225-229` | Performance tier header dark mode contrast | Use `dark:text-blue-200` instead of `dark:text-blue-300` |

### LOW Priority

| ID | File | Description | Action |
|---|---|---|---|
| C25-04/C24-06 | `greedy.ts:224` | buildCardResults totalSpending no negative guard | Add `Math.abs(tx.amount)` in reduce |
| C25-02/C23-02 | `analyzer.ts:47` | cachedCoreRules never invalidated | Add TTL-based invalidation or expose reset method |

## Implementation Steps

### Step 1: Fix CATEGORY_COLORS dark mode contrast (C25-01) -- DONE

Commit: `000000026e` fix(web): improve CATEGORY_COLORS dark mode contrast

- `water: '#1f2937'` → `water: '#64748b'` (slate-500, visible on dark bg)
- `gas: '#374151'` → `gas: '#94a3b8'` (slate-400, visible on dark bg)
- `electricity: '#4b5563'` → `electricity: '#9ca3af'` (gray-400, visible on dark bg)

### Step 2: Add console.warn to pdf.ts tryStructuredParse catch (C25-06/D-106) -- DONE

Commit: `00000003d6` fix(web): add diagnostic logging to pdf.ts tryStructuredParse catch

- Bare `catch {}` replaced with `catch (err)` that logs a warning before returning null
- Fallback line-scanner behavior preserved

### Step 3: Fix CardDetail performance tier header dark mode contrast (C25-09/C53-03) -- DONE

Commit: `00000004d4` fix(web): improve performance tier header dark mode contrast in CardDetail

- `dark:text-blue-300` changed to `dark:text-blue-200` on performance tier group header row

### Step 4: Add negative amount guard in buildCardResults (C25-04/C24-06) -- DONE

Commit: `00000005ff` fix(core): add Math.abs guard in buildCardResults totalSpending

- `sum + tx.amount` changed to `sum + Math.abs(tx.amount)` in totalSpending reduce

### Step 5: Run quality gates -- DONE

All gates pass:
- Lint: 0 errors, 0 warnings across all workspaces
- Typecheck: 0 errors, 0 warnings across all workspaces
- Tests: 266 pass, 0 fail
- Build: 5 pages built successfully

## Deferred Items

The following findings from this cycle are deferred per repo rules:

| ID | Severity | Reason | Exit Criterion |
|---|---|---|---|
| C25-02/C23-02/C21-04 | LOW→MEDIUM | cachedCoreRules invalidation requires architectural decision about cache TTL vs. session-scoped invalidation. Current behavior is correct for the typical single-session use case. | When long-lived tabs become a reported user issue or when cards.json is updated more frequently than per-deploy |
| C25-03/C20-02 | LOW | DATE_PATTERNS divergence risk is acknowledged with a code comment. Adding a unit test would be valuable but requires designing a test that validates regex coverage against parseDateStringToISO's behavior. | When a new date format is added that causes a parse mismatch |
| C25-08/C8-07/C4-14 | LOW | build-stats.ts fallback values drift is logged at build time. The fallback is only used when cards.json is unavailable, which should never happen in production builds. | When CI pipeline is set up to compare fallback values against actual JSON |
| C25-10/C20-04 | LOW | pdf.ts regex constants divergence is the same class as C25-03/C20-02. Same rationale. | When a new date format is added that causes a parse mismatch |
| C25-11/C22-05 | LOW | TransactionReview O(n) changeCategory copy is acceptable for typical transaction counts (< 1000). Svelte 5 reactivity requires array reassignment. | When transaction lists exceed ~5000 entries and UI becomes sluggish |
