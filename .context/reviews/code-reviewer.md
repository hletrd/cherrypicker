# Code Reviewer — Cycle 4 Findings

## Summary
13 findings across code quality, maintainability, and correctness. 3 critical, 5 high, 5 medium.

## Findings

### C-CR-01 [CRITICAL] Library code emits console.warn
- **File**: `packages/core/src/calculator/reward.ts` lines 202-206, 277-281, 299-300
- **Issue**: `calculateRewards()` calls `console.warn` for unknown reward types and fallback branches. Pure calculation library should not emit console output.
- **Fix**: Replace with a structured logger parameter or return warnings in the result object.

### C-CR-02 [CRITICAL] Non-null assertion on unsafe regex match
- **File**: `packages/parser/src/pdf/index.ts` line 361
- **Issue**: `(amountMatch[1] ?? ... ?? amountMatch[7])!` — non-null assertion after nullable chain. Can throw at runtime.
- **Fix**: Add explicit null check and throw with context.

### C-CR-03 [CRITICAL] FileDropzone `errorMessage` vs `errorMessages` mismatch
- **File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 251, 314, 363
- **Issue**: Variable declared as `errorMessages` but referenced as `errorMessage`, causing ReferenceError on error paths.
- **Fix**: Rename all references consistently.

### C-CR-04 [HIGH] O(n^2 log n) sort in greedy optimizer
- **File**: `packages/core/src/optimizer/greedy.ts` lines 92-94
- **Issue**: `rules.indexOf(a)` inside comparator causes O(n^2 log n) sort. With many cards this is slow.
- **Fix**: Precompute index map before sort.

### C-CR-05 [HIGH] Duplicate CATEGORY_NAMES_KO in greedy.ts
- **File**: `packages/core/src/optimizer/greedy.ts` lines 11-89
- **Issue**: Hardcoded category name map duplicates `packages/rules/data/categories.yaml`. Risk of drift.
- **Fix**: Import from YAML or shared constants.

### C-CR-06 [HIGH] MerchantMatcher scans all 10,000 keywords on every call
- **File**: `packages/core/src/categorizer/matcher.ts` line 37-103
- **Issue**: No caching/memoization. Substring scan over `SUBSTRING_SAFE_ENTRIES` on every transaction.
- **Fix**: Add LRU cache keyed by merchant name.

### C-CR-07 [HIGH] Web parsers drop refunds (amount <= 0 filter)
- **Files**: `apps/web/src/lib/parser/csv.ts:175`, `html.ts:212`, `xlsx.ts:617`, `pdf.ts:440`
- **Issue**: Refund transactions silently discarded. JSON parser handles them correctly.
- **Fix**: Change to `amount === 0` + `Math.abs()` pattern, match JSON parser.

### C-CR-08 [MEDIUM] console.warn in PDF structured parse failure
- **File**: `packages/parser/src/pdf/index.ts` line 264
- **Issue**: Parser emits console.warn on parse failure.
- **Fix**: Return warnings in result object.

### C-CR-09 [MEDIUM] Web-side card type duplicates rules schema
- **File**: `apps/web/src/lib/cards.ts` lines 14-52
- **Issue**: `CardRuleSet` redefined inline instead of importing from `@cherrypicker/rules`.
- **Fix**: Import and extend from shared types.

### C-CR-10 [MEDIUM] Magic numbers in timeout durations
- **Files**: `packages/parser/src/pdf/llm-fallback.ts` (30s), `tools/scraper/src/extractor.ts` (no timeout)
- **Issue**: LLM timeout hardcoded; scraper has no timeout at all.
- **Fix**: Centralize timeout constants in config.

### C-CR-11 [MEDIUM] Unsafe regex lastIndex reset
- **File**: `packages/parser/src/detect.ts` line 183
- **Issue**: `pattern.lastIndex = 0` on non-global regexes is defensive but confusing.
- **Fix**: Use `exec()` or match directly without stateful regex.

### C-CR-12 [MEDIUM] OFX date parsing strips too aggressively
- **File**: `packages/parser/src/ofx/index.ts` line 73-80
- **Issue**: `replace(/[^0-9].*$/, '')` strips timezone info, potentially incorrect dates.
- **Fix**: Parse full ISO-like string, handle timezone explicitly.

### C-CR-13 [MEDIUM] HTML forward-fill mutates parsed array in place
- **File**: `packages/parser/src/html/index.ts` lines 137-215
- **Issue**: Forward-fill modifies rows in place during iteration.
- **Fix**: Clone rows before mutation or build new array.

## Recommendations
1. Introduce a shared `logger` interface for all packages
2. Add `readonly` annotations to parser data structures
3. Extract shared `validateAmount()` from all web parsers
