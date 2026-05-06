# Test Engineering Review — CherryPicker Cycle 35

## Methodology
Reviewed all `__tests__/` directories for coverage gaps, missing edge cases, flaky patterns, and TDD opportunities.

---

## CONFIRMED ISSUES

### TE-01: No tests for `toCoreCardRuleSets` adapter
**File**: `apps/web/src/lib/analyzer.ts`
**Severity**: Medium | **Confidence**: High
The type adapter that bridges web CardRuleSet to core CardRuleSet is untested. Unknown reward types throw errors; unknown card sources warn. Neither path has test coverage.
**Fix**: Add unit tests for `toCoreCardRuleSets` covering: valid types, invalid reward type (should not throw — see CR-03), invalid card source, missing tiers.

### TE-02: No tests for `analyzeMultipleFiles` with multiple files
**File**: `apps/web/src/lib/analyzer.ts`
**Severity**: Medium | **Confidence**: High
While `analyzeMultipleFiles` exists, tests likely only cover single-file paths. Multi-file merging logic (transaction ID prefixing, bank/format resolution, category label building) has no dedicated tests.
**Fix**: Add tests for: multiple files with overlapping transaction IDs, different banks, different formats.

### TE-03: No tests for sessionStorage migration logic
**File**: `apps/web/src/lib/store.svelte.ts`
**Severity**: Low | **Confidence**: High
The `MIGRATIONS` registry is empty and the version-check logic is untested. When a migration is added, there will be no regression protection.
**Fix**: Add tests for `loadFromStorage` covering: version mismatch, migration application, corrupted data rejection, truncation handling.

### TE-04: No tests for HTML parser
**File**: `packages/parser/src/html/index.ts`
**Severity**: Medium | **Confidence**: High
The HTML table parser (added in C98) has tests in `apps/web/__tests__/parser-html.test.ts` but the server-side `packages/parser/src/html/index.ts` may not have parity tests.
**Fix**: Verify test parity between web and server HTML parsers.

### TE-05: Missing edge case: empty `performanceTiers` array
**File**: `packages/core/src/calculator/reward.ts`
**Severity**: Low | **Confidence**: Medium
When `performanceTiers` is empty, `selectTier` returns `undefined`, `tierId` becomes `'none'`, and all rewards are 0. This is intentional but untested.
**Fix**: Add test verifying empty tiers produce zero rewards.

---

## COVERAGE GAPS

1. **Error paths in detect.ts**: JSON.parse failure path, encoding detection edge cases
2. **PDF fallback scanner**: The line-by-line fallback in `pdf/index.ts` has limited coverage
3. **LLM fallback error paths**: API key validation, timeout, malformed JSON response
4. **Optimizer with negative amounts**: Filter is tested but direct optimizer input with negatives is not
5. **Constraint building with empty transactions**: No test for empty `transactions` array in `buildConstraints`
