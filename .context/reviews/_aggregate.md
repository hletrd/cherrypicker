# Aggregate Review -- Cycle 43

## New Findings: 2 actionable, 2 deferred, 3 low/info

### Actionable (implement this cycle)

**F1. findColumn exact-match path skips combined-header splitting [MEDIUM]**
- Both server and web column-matcher.ts
- When exactName is "이용일" and header is "이용일/승인일", the exact-match path fails because normalized comparison is "이용일/승인일" !== "이용일"
- The regex fallback catches it, but the exact-match path should also split on "/" for consistency
- Fix: Split combined headers in the exact-match path too

**F2. Web CSV: 10 hand-rolled adapters duplicate factory pattern [HIGH]**
- apps/web/src/lib/parser/csv.ts lines 322-1019
- 10 adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc) are near-identical
- The factory pattern already exists at line 1037 for 14 other adapters
- Migrating would eliminate ~700 lines of duplication
- Deferred: too large for this cycle, but worth tracking

### Deferred
- **A2. Column-matcher duplication (server vs web)** — requires shared-module refactor
- **A3. ColumnMatcher location** — csv/ is misleading for a shared module

### Low/Info
- **F3.** Server XLSX lacks non-numeric header guard (low risk)
- **F4.** PDF AMOUNT_PATTERN inconsistency (intentional, undocumented)
- **F5.** No test for tab-separated CSV with quoted fields containing tabs

## Test Status
- 703 bun tests passing
- 252 vitest tests passing
- 0 regressions

## Priority Order for Implementation
1. F1: findColumn exact-match combined-header fix + tests
2. F5: Add tab-separated CSV test
3. T1: Add findColumn combined-header test