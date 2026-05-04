# Cycle 57 Aggregate Review

## Findings (3 actionable, 2 deferred)

### F1: Trailing delimiter characters break date detection (BUG - Medium)
**Severity**: Medium — real format from Korean bank exports
**Scope**: 8 files across server+web CSV/PDF parsers
**Impact**: Date column not detected → generic CSV returns 0 transactions; PDF misses dates
**Fix**: Strip trailing delimiter characters before detection/validation in all date functions

### F2: AMOUNT_PATTERNS KRW pattern casing (BUG - Low)
**Severity**: Low — works via /i flag, inconsistent intent
**Impact**: Negligible — amounts caught by other patterns
**Fix**: No action needed

### F3: Missing test coverage for edge cases (Enhancement)
**Severity**: Low — test coverage gap
**Fix**: Add tests for trailing-delimiter dates, full-width amounts

### Deferred:
- F4: Web-side hand-written CSV adapters (architectural)
- F5: PDF multi-line header support (complex)

## Tests Passing
- 862 bun tests
- 129 vitest tests