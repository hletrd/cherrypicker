# Cycle 43 Architect Review

**Reviewer:** architect
**Focus:** Server/web parity, format diversity gaps, architecture

## Server/Web Parity Status

### Achieved
- 24 bank adapters on both sides
- Column matching: shared patterns and logic
- Date parsing: identical logic (shared date-utils.ts)
- Amount parsing: identical (Won sign, parenthesized negatives, 마이너스)
- Summary row detection: identical regex
- Header detection: identical isValidHeaderRow()
- HTML-as-XLS: identical detection and normalization
- Forward-fill for merged XLSX cells: identical
- ParseError reporting: identical

### Remaining Divergences
1. **Web CSV: 10 hand-rolled adapters** vs server's factory pattern — ~700 lines duplication (A1)
2. **Server PDF: LLM fallback** — web lacks this (by design; requires server API)
3. **Import styles** — server uses CJS `import xlsx from 'xlsx'`, web uses ESM `import * as XLSX from 'xlsx'`

## Architecture Debt

### A1. Web CSV duplication (~700 lines) [HIGH]
10 hand-rolled adapters in `apps/web/src/lib/parser/csv.ts` duplicate the factory pattern. The factory is already defined at line 1037 for 14 other adapters. Migrating the 10 adapters to use it would eliminate ~700 lines.

### A2. Column-matcher duplication (server vs web) [MEDIUM — deferred]
Web-side `column-matcher.ts` is a copy of server-side. Known architectural limitation requiring shared-module refactor.

### A3. ColumnMatcher location (csv/ for shared module) [LOW — deferred]
Server-side column-matcher.ts lives in `csv/` but is used by CSV, XLSX, and PDF parsers. Moving to `packages/parser/src/column-matcher.ts` would be cleaner.

## Summary
Solid architecture. A1 (web CSV factory migration) is the single highest-impact improvement available.