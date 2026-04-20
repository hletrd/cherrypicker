# Cycle 22 Implementation Plan

## New Findings to Address

### C22-01 (MEDIUM): pdf.ts parseAmount uses parseInt instead of Math.round
- **File:** `apps/web/src/lib/parser/pdf.ts`
- **Problem:** `parseAmount` uses `parseInt` which truncates decimal values, inconsistent with csv.ts (C21-03 fix) and xlsx.ts (C20-01 fix) which now use `Math.round(parseFloat(...))`. For a string like "1,234.56", pdf.ts would produce 1234 while csv.ts produces 1235.
- **Fix:** Change `parseInt(raw.replace(...), 10)` to `Math.round(parseFloat(raw.replace(...)))` in `pdf.ts:166-172` to match the csv.ts and xlsx.ts parsers. The `Number.isNaN` fallback (returning 0) needs to be preserved.
- **Status:** DONE -- committed as `0000000c8c9117179edc39f5fccaf98cd88dbd98`

### C22-02 (LOW): SavingsComparison count-up animation ignores prefers-reduced-motion
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte`
- **Problem:** The count-up animation `$effect` uses `requestAnimationFrame` without checking for `prefers-reduced-motion`. Users with reduced motion preferences will still see the animation.
- **Fix:** Check `window.matchMedia('(prefers-reduced-motion: reduce)')` at the start of the effect. If it matches, set `displayedSavings = target` immediately without animation.
- **Status:** DONE -- committed as `00000009bf636f60643a9787569a2373f06f6ab0`

### C22-03 (LOW): persistToStorage truncation doesn't record count
- **File:** `apps/web/src/lib/store.svelte.ts`, `apps/web/src/components/dashboard/SpendingSummary.svelte`
- **Problem:** `persistToStorage` truncates transactions when over 4MB but does not record how many transactions were omitted. The user sees a generic warning with no indication of data loss magnitude.
- **Fix:** When truncating, store the original transaction count in the persisted object (`_truncatedTxCount`). On load, if transactions are missing but a count was recorded, include the count in the warning display. Changed `persistToStorage` return type from `PersistWarningKind` to `PersistResult` with `kind` and `truncatedTxCount` fields.
- **Status:** DONE -- committed as `000000020286cdec8f480a20c231a8d4cef8233f`

## Previously Open Findings Addressable This Cycle

### C8-01 (MEDIUM): AI categorizer disabled but dead code in TransactionReview
- **File:** `apps/web/src/lib/categorizer-ai.ts`, `apps/web/src/components/dashboard/TransactionReview.svelte`
- **Problem:** `categorizer-ai.ts` is a ~40 line stub that always throws/disables. TransactionReview.svelte has 8 lines of re-enable comments (lines 6-13). This dead code adds maintenance burden and confusion.
- **Fix:** Remove the 8-line re-enable comment block from TransactionReview.svelte. Keep the categorizer-ai.ts stub as a minimal placeholder (it's only 40 lines and documents the disabled state clearly). Add a single-line comment in TransactionReview pointing to categorizer-ai.ts for re-enable instructions.
- **Status:** DONE -- committed as `000000061903a6d295dffdd0b5351aaccf970438`

## Deferred Items

### C22-04 (LOW): CSV adapter registry only covers 10 of 24 detected banks
- **Reason for deferral:** Adding 14 bank-specific CSV adapters is a large feature addition, not a bug fix. The generic CSV parser handles these banks with reduced reliability. The XLSX parser already has full coverage. This is tracked as D-06 in the deferred items file.
- **Exit criterion:** Dedicated feature cycle to add bank-specific CSV adapters for the 14 unsupported banks, or convergence of web and packages/parser implementations.

### C22-05 (LOW): TransactionReview changeCategory O(n) array copy
- **Reason for deferral:** Typical statement sizes (50-200 transactions) make this imperceptible. The functional correctness is not affected. Only relevant for pathological inputs (1000+ transactions).
- **Exit criterion:** Performance issue observed in practice with large statements, or a broader state management refactor (e.g., immutable store with structural sharing).
