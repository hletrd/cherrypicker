# Code Review -- Cycle 44

## Findings: 3 actionable, 2 deferred, 2 low/info

### Actionable

**F1. Server XLSX: missing non-numeric header row guard [LOW]**
- `packages/parser/src/xlsx/index.ts` line 239-247
- Both server and web CSV generic parsers require `hasNonNumeric` (cells must contain `[가-힣a-zA-Z]`) before calling `isValidHeaderRow()`
- XLSX parser calls `isValidHeaderRow()` directly without the non-numeric guard
- Risk: a purely numeric row with amount keywords could be misidentified as header
- Practical risk is very low because `isValidHeaderRow` requires keywords from 2+ distinct categories
- Fix: add non-numeric guard for consistency with CSV parsers

**F2. PDF isValidShortDate rejects Feb 29 in leap years [LOW]**
- `packages/parser/src/pdf/index.ts` line 29, `MAX_DAYS_PER_MONTH` hardcodes Feb as 28 days
- `isValidShortDate()` uses this table, so "2.29" would be rejected even in leap years
- `parseDateStringToISO()` in date-utils.ts uses `isValidDayForMonth()` which handles leap years correctly via `Date(year, month, 0).getDate()`
- CSV `isDateLikeShort()` uses `daysInMonth(new Date().getFullYear(), month)` which is leap-year-aware
- Impact: very low — Korean PDFs rarely use short date format for Feb 29; full format "2024.02.29" bypasses this check
- Fix: use `daysInMonth()` from date-utils.ts with current year instead of hardcoded table

**F3. XLSX header detection: inconsistent non-numeric guard with CSV [LOW]**
- Same as F1 but for web-side XLSX parser at `apps/web/src/lib/parser/xlsx.ts` line 419-427
- Fix: add matching guard for consistency

### Deferred

**A1. Web CSV: 10 hand-rolled adapters duplicate factory pattern [HIGH]**
- apps/web/src/lib/parser/csv.ts lines 322-1019 (~700 lines)
- Factory pattern exists at line 1037 for 14 other adapters
- Highest-priority deferred item across all cycles

**A2. Column-matcher module duplication (server vs web) [MEDIUM]**
- Requires shared-module refactor for Bun/browser environment compatibility

### Low/Info

**F4. All existing tests continue to pass (709 bun + 252 vitest)**
- No regressions detected

**F5. Server/web parity confirmed**
- Column patterns, normalizeHeader, findColumn, isValidHeaderRow, SUMMARY_ROW_PATTERN all match
- Bank adapter configs (24 banks) are identical across all parsers
- Date utils, amount parsing, installment handling all in sync