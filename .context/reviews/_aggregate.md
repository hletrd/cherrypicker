# Cycle 71 Aggregate Review

## Findings (1 actionable)

### C71-01: AMOUNT_PATTERNS missing leading-plus pattern (FORMAT DIVERSITY - MEDIUM)

All four CSV/PDF parsers' column-detection amount patterns lack support for leading-plus amounts (`+1,234`). The actual parse functions DO handle leading-plus (added C66-02), but the column-detection patterns were not updated. This causes generic CSV parsing to fail when banks export amounts with explicit `+` prefix.

**Fix:** Add `^\+[\d,]+원?$` to CSV `AMOUNT_PATTERNS` arrays. Add `\+(?=[\d,])` alternative to PDF `AMOUNT_PATTERN` / `STRICT_AMOUNT_PATTERN`.

### C71-02: No test coverage for leading-plus column detection (TEST - LOW)

Need test verifying that generic CSV parser with `+1,234` amounts correctly infers the amount column.

## No Regressions

Server/web parity is excellent. All major format diversity issues have been addressed over 70 cycles. Architecture is mature.