# Performance Reviewer — Cycle 4 Findings

## Summary
7 findings. 2 critical performance bottlenecks, 3 high, 2 medium.

## Findings

### P-PR-01 [CRITICAL] Greedy optimizer sort is O(n^2 log n)
- **File**: `packages/core/src/optimizer/greedy.ts` lines 92-94
- **Issue**: Comparator uses `rules.indexOf(a)` for tie-breaking. With 50+ cards, `sort()` calls comparator O(n log n) times, each `indexOf` is O(n), yielding O(n^2 log n).
- **Impact**: Optimization slows quadratically with card count.
- **Fix**: Pre-build `Map<CardRuleSet, number>` for O(1) index lookup.

### P-PR-02 [CRITICAL] MerchantMatcher O(n*m) per transaction
- **File**: `packages/core/src/categorizer/matcher.ts` lines 37-103
- **Issue**: Every `match()` call iterates all ~10,000 `SUBSTRING_SAFE_ENTRIES` and tests regex/substring on each. No memoization.
- **Impact**: Categorizing 1,000 transactions = 10M+ regex/substring ops.
- **Fix**: Add LRU cache with 1000-entry cap keyed by merchant string.

### P-PR-03 [HIGH] PDF LLM fallback truncates to 8000 chars
- **File**: `packages/parser/src/pdf/llm-fallback.ts` line 48
- **Issue**: Text truncated at 8000 chars with no retry on remaining content. Missing transactions from later pages.
- **Fix**: Chunk text and merge results, or increase limit.

### P-PR-04 [HIGH] fetcher.ts loses abort timeout on second fetch
- **File**: `tools/scraper/src/fetcher.ts` (inferred from cycle 2)
- **Issue**: Abort controller timeout not applied to secondary fetch for EUC-KR detection.
- **Fix**: Apply timeout to all fetch calls.

### P-PR-05 [HIGH] SheetJS parses entire HTML document into workbook
- **File**: `packages/parser/src/html/index.ts` line 32-77
- **Issue**: SheetJS loads full HTML into memory then scans for tables. Large HTML files consume excessive memory.
- **Fix**: Pre-filter to `<table>` elements before SheetJS ingestion.

### P-PR-06 [MEDIUM] PDF parser allocates intermediate strings for every line
- **File**: `packages/parser/src/pdf/index.ts` lines 68-267
- **Issue**: `tryStructuredParse()` splits text into lines then reconstructs strings repeatedly.
- **Fix**: Use index-based scanning to reduce allocations.

### P-PR-07 [MEDIUM] Store.svelte.ts loads full analysis from sessionStorage synchronously
- **File**: `apps/web/src/lib/store.svelte.ts`
- **Issue**: Large analyses block initial render. sessionStorage read is synchronous and unbounded.
- **Fix**: Lazy-load or cap stored result size.

## Recommendations
1. Profile optimizer with 100+ card rules to confirm sort bottleneck
2. Add benchmark for MerchantMatcher with 1000 transactions
3. Consider Web Workers for PDF parsing in browser
