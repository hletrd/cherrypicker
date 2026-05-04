# Cycle 57 Review — Format Diversity

## Findings (3 actionable, 2 deferred carried)

### F1: Trailing delimiter characters break date detection (BUG - Medium)
**Severity**: Medium — real format from Korean bank exports
**Scope**: All date detection/validation functions (server+web CSV, server+web PDF)
**Root cause**: Date regex patterns use `$` end anchor, but Korean bank exports commonly
  emit dates with trailing delimiters like "2024. 1. 15." or "1/15/". The actual
  `parseDateStringToISO()` works fine (regexes are not anchored), but column detection
  via `isDateLike()` / `isValidShortDate()` / `isValidDateCell()` / `findDateCell()`
  fail because the `$` anchor rejects the trailing character.
**Impact**: Date column not detected → generic CSV parser returns 0 transactions.
  PDF findDateCell skips valid date cells → fewer transactions parsed.
**Fix**: Strip trailing delimiter characters before detection/validation. Apply in:
  - `packages/parser/src/csv/generic.ts` — isDateLike(), isDateLikeShort()
  - `packages/parser/src/date-utils.ts` — parseDateStringToISO()
  - `packages/parser/src/pdf/table-parser.ts` — isValidDateCell()
  - `packages/parser/src/pdf/index.ts` — findDateCell(), isValidShortDate()
  - `apps/web/src/lib/parser/csv.ts` — isDateLike(), isDateLikeShort()
  - `apps/web/src/lib/parser/pdf.ts` — isValidDateCell(), findDateCell(), isValidShortDate()

### F2: AMOUNT_PATTERNS KRW pattern casing inconsistency (BUG - Low)
**Severity**: Low — parsing already works via other patterns
**Scope**: server+web generic CSV AMOUNT_PATTERNS arrays
**Root cause**: `^KRW[\d,]+원?$/i` only matches uppercase "KRW" literally since
  isAmountLike() uses the original cell value, not lowered. The /i flag handles it
  correctly, but it's inconsistent to have a case-insensitive pattern on a
  case-sensitive input when all other patterns are case-sensitive.
**Impact**: Negligible — "KRW" amounts are already caught by digit+comma patterns.
**Fix**: Already works via /i flag. No action needed.

### F3: Missing test coverage for edge cases (Enhancement)
**Severity**: Low — test coverage gap
**Scope**: packages/parser/__tests__/
**Fix**: Add tests for:
  - Dates with trailing delimiters ("2024. 1. 15.", "1/15/")
  - Short dates with trailing delimiters in isValidShortDate
  - YYMMDD date detection with validation
  - Amount parsing with full-width digits

### Deferred (carried):
- F4: Web-side hand-written CSV adapters (deferred, architectural)
- F5: PDF multi-line header support (deferred, complex)