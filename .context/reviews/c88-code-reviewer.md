# Code Reviewer — Cycle 88

## Summary
Full codebase review focusing on code quality, logic, SOLID, and maintainability.

## Findings

### C88-01: SavingsComparison annual projection sign-prefix uses animated value (MEDIUM, HIGH)
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:240`
**Problem:** The annual projection line uses `displayedAnnualSavings` (animated intermediate) for `Math.abs()` and `+` prefix decisions instead of `opt.savingsVsSingleCard` (final target). The monthly line (238) correctly uses `opt.savingsVsSingleCard`. During animation transitions, the annual line can show wrong sign/prefix briefly.
**Fix:** Use `opt.savingsVsSingleCard < 0` for Math.abs decision, `opt.savingsVsSingleCard * 12 >= 100` for `+` prefix threshold.

### C88-03: CATEGORY_COLORS hardcoded map drift risk (LOW, MEDIUM)
**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84`
**Problem:** 84-entry hardcoded color map is not auto-generated from YAML taxonomy. New subcategories will get gray fallback.
**Fix:** Generate from taxonomy data or add a CI check.

### C88-04: ALL_BANKS 5th copy of bank list (LOW, MEDIUM)
**File:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
**Problem:** Hardcoded bank list that must be kept in sync with 4+ other locations.
**Fix:** Import from a shared source.

### C88-05: formatIssuerNameKo hardcoded map drift risk (LOW, MEDIUM)
**File:** `apps/web/src/lib/formatters.ts:51-79`
**Problem:** Hardcoded issuer name map that will drift from data.
**Fix:** Generate from cards.json data at build time.

### C88-06: getIssuerColor hardcoded map drift risk (LOW, MEDIUM)
**File:** `apps/web/src/lib/formatters.ts:115-143`
**Problem:** Hardcoded issuer color map that will drift from data.
**Fix:** Generate from cards.json data at build time.

### Code Quality Notes
- The codebase has consistent defensive coding patterns with cycle-specific comments (C##-##) tracing each fix to its review cycle. This is excellent for auditability.
- Parser code (csv.ts, xlsx.ts, pdf.ts) has significant duplication across bank adapters, but this is documented with C70-04 noting the architectural barrier (Bun vs browser module split).
- The store.svelte.ts is well-structured with proper null guards and snapshot patterns (C81-01).
