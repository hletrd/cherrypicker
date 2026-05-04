# Aggregate Review -- Cycle 45

## New Findings: 2 actionable

### Actionable (implement this cycle)

**F1. CSV generic `^\d{6}$` DATE_PATTERN too broad for column detection [MEDIUM]**
- `packages/parser/src/csv/generic.ts` line 29, `apps/web/src/lib/parser/csv.ts` line 139
- Fix: add `isYYMMDDLike()` validation with month/day range checks

**F2. CSV `AMOUNT_PATTERNS` lack boundary guards [LOW]**
- `packages/parser/src/csv/generic.ts` lines 52-59, `apps/web/src/lib/parser/csv.ts` lines 161-168
- Fix: add hyphen exclusion to amount pattern boundary checks

### Test Gaps

**T1.** No test for 6-digit YYMMDD false positive in column detection
**T2.** No test for amount pattern boundary guards

### Deferred (unchanged)

| Item | Reason |
|------|--------|
| D-01 | Server/web shared module -- architectural refactor |
| D-02 | PDF multi-line headers -- edge case |