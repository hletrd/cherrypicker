# Cycle 20 Implementation Plan

## New Findings to Address

### C20-01 [MEDIUM] -- XLSX parseAmount string path truncates instead of rounding
- **File:** `apps/web/src/lib/parser/xlsx.ts:206-221`
- **Problem:** `parseAmount` for string input uses `parseInt(cleaned, 10)` which truncates decimal values (e.g., "1,234.56" -> 1234), while numeric input uses `Math.round(raw)` which rounds (e.g., 1234.56 -> 1235). For Korean Won amounts this is irrelevant (always integers), but the inconsistency is a maintenance risk and could confuse future developers who expect both paths to behave identically.
- **Fix:** Use `Math.round(parseFloat(cleaned))` in the string path instead of `parseInt(cleaned, 10)`. This matches the numeric path's rounding behavior. `parseFloat` correctly handles the cleaned string (commas already stripped, suffix removed). `Math.round` then rounds to the nearest integer. If `parseFloat` returns NaN, the existing `Number.isNaN` guard catches it.
  - Change line 218 from `const parsed = parseInt(cleaned, 10);` to `const parsed = Math.round(parseFloat(cleaned));`
- **Risk:** Low -- functional behavior unchanged for integer KRW amounts. Rounding vs truncation only differs for decimal inputs, which are not expected.

### C20-02 [LOW] -- CSV DATE_PATTERNS divergence risk from shared parseDateStringToISO
- **File:** `apps/web/src/lib/parser/csv.ts:60-72`
- **Problem:** `DATE_PATTERNS` in csv.ts is a separate list of regex patterns used only for the `isDateLike` column detection heuristic in the generic CSV parser. If a new date format is added to `parseDateStringToISO` in `date-utils.ts`, `DATE_PATTERNS` would not be updated, causing the generic CSV parser to not recognize the new format's date columns.
- **Fix:** Add a comment to `DATE_PATTERNS` noting that it must be kept in sync with `parseDateStringToISO` in `date-utils.ts`. The patterns serve different purposes (column detection vs actual parsing), so merging them is not practical, but the documentation ensures future developers know to update both.
- **Risk:** None -- documentation only.

### C20-03 [LOW] -- isOptimizableTx uses `any` instead of `unknown`
- **File:** `apps/web/src/lib/store.svelte.ts:144`
- **Problem:** `isOptimizableTx(tx: any)` uses `any` parameter type, which bypasses TypeScript's excess property checking. Using `unknown` would be safer and require explicit narrowing before property access (which the type guard already does).
- **Fix:** Change `tx: any` to `tx: unknown` in the function signature. The type guard body already checks `typeof tx === 'object'` and property types before accessing them, so `unknown` is safe. Update the narrowed type assertion accordingly.
- **Risk:** Low -- TypeScript will verify that all property accesses are guarded. The function already has all necessary checks.

### C20-04 [LOW] -- PDF module-level regex constants divergence risk from shared date-utils
- **File:** `apps/web/src/lib/parser/pdf.ts:16-22`
- **Problem:** Same class as C20-02. Module-level regex constants (`DATE_PATTERN`, `AMOUNT_PATTERN`, etc.) in the PDF parser are used for table parsing / fallback detection and are not shared with `parseDateStringToISO` in `date-utils.ts`. Adding a new date format to `date-utils.ts` would not update the PDF patterns.
- **Fix:** Add a comment noting that these patterns must be kept in sync with `parseDateStringToISO` in `date-utils.ts`. The patterns serve different purposes (PDF table row detection vs actual date parsing), so merging is impractical, but documentation prevents divergence.
- **Risk:** None -- documentation only.

### C20-05 [LOW] -- buildPageUrl does not guard against leading slashes
- **File:** `apps/web/src/lib/formatters.ts:188-191`
- **Problem:** `buildPageUrl(path)` concatenates `base` + `/` + `path`. If `path` starts with `/`, the result has a double slash. Current callers always pass bare names, but this constraint is undocumented.
- **Fix:** Add a guard that strips a leading slash from `path` before concatenation. Also add a JSDoc `@param` noting that `path` should be a bare page name (e.g., `'dashboard'`), not a path with leading slash.
- **Risk:** None -- functional behavior unchanged for existing callers; defensive for future callers.

## Implementation Order & Status

1. **C20-01** -- Fix XLSX parseAmount inconsistency (use Math.round(parseFloat)) -- **DONE**
2. **C20-03** -- Change `isOptimizableTx` parameter from `any` to `unknown` -- **DONE**
3. **C20-05** -- Guard buildPageUrl against leading slashes -- **DONE**
4. **C20-02** -- Add sync-comment to csv.ts DATE_PATTERNS -- **DONE**
5. **C20-04** -- Add sync-comment to pdf.ts module-level patterns -- **DONE**

## Deferred Items

- **C19-04 + C19-05**: `navigate()` from `astro:transitions/client` requires `<ClientRouter />` in the Astro layout. The project currently uses static output mode without View Transitions. Enabling ClientRouter is an architectural change that requires testing all pages for compatibility. Deferred until a dedicated cycle for View Transitions adoption.
- All prior deferred items from `00-deferred-items.md` remain unchanged.
