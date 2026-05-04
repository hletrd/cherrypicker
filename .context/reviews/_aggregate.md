# Aggregate Review -- Cycle 44

## New Findings: 3 actionable, 2 deferred, 2 low/info

### Actionable (implement this cycle)

**F1. Server XLSX: missing non-numeric header row guard [LOW]**
- `packages/parser/src/xlsx/index.ts` line 239-247
- CSV parsers require `hasNonNumeric` guard; XLSX does not
- Fix: add guard for consistency

**F2. PDF isValidShortDate rejects Feb 29 in leap years [LOW]**
- `packages/parser/src/pdf/index.ts` line 29
- MAX_DAYS_PER_MONTH hardcodes Feb as 28; CSV parser uses daysInMonth()
- Fix: use daysInMonth() from date-utils.ts

**F3. Web XLSX: same non-numeric guard inconsistency [LOW]**
- `apps/web/src/lib/parser/xlsx.ts` line 419-427
- Fix: add matching guard

### Deferred
- **A1. Web CSV 10 hand-rolled adapters -> factory** (~700 lines, too large)
- **A2. Column-matcher module duplication** (server vs web)

### Low/Info
- **F4.** All 709 bun + 252 vitest tests pass, 0 regressions
- **F5.** Server/web parity confirmed across all 24 bank adapters

## Test Status
- 709 bun tests passing
- 252 vitest tests passing
- 0 regressions

## Priority Order for Implementation
1. F2: PDF isValidShortDate leap year fix
2. F1+F3: XLSX non-numeric header guard (both sides)
3. Tests for both fixes