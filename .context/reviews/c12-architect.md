# Architect — Cycle 12

**Date:** 2026-05-05
**Reviewer:** architect

## Architectural Findings

### A12-01: Server/web parser duplication remains the primary tech debt
After 12 cycles, the server and web parsers remain separate codebases with significant duplication: ColumnMatcher, date-utils, CSV parsers, XLSX parsers, PDF parsers, bank column configs, and detect module. The D-01 refactor remains deferred.

### A12-02: Column-matcher is the right abstraction (GOOD)
The `findColumn()` pattern with exact-then-regex matching has held up well. The shared `HEADER_KEYWORDS` and category-based `isValidHeaderRow()` are well-designed.

### A12-03: Adapter factory pattern is clean (GOOD)
The server-side `createBankAdapter()` factory reduces 10 bank adapters to config objects. The web side should adopt this pattern.

## Recommendations
1. Fix C12-01 (date error reporting in adapter-factory)
2. Add column-matcher dedicated tests
3. Align web XLSX with shared findColumn
4. Add CSV isDateLike whitespace tolerance