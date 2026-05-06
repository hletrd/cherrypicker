# Code Review — Cycle 38

## New Findings

### CR-38-01: isValidCSVAmount silently skips non-positive amounts
**Severity:** Medium | **Confidence:** High | **File:** `packages/parser/src/csv/shared.ts:122`

The `isValidCSVAmount` function returns `false` for `amount <= 0` without pushing a `ParseError`, unlike the JSON and OFX parsers which now emit explicit errors after cycle 37 fixes.

```typescript
if (amount <= 0) return false;  // No error pushed — silent skip
```

**Impact:** Users uploading CSV/XLSX files see no feedback when refunds or credits are filtered out, while JSON/OFX users do.

**Fix:** Add `ParseError` push before returning false, consistent with JSON/OFX pattern.

### CR-38-02: Web-side XLSX parser silent skip
**Severity:** Low | **Confidence:** Medium | **File:** `apps/web/src/lib/parser/xlsx.ts`

Web-side XLSX parser likely has the same `amount <= 0` silent skip pattern. Needs verification.

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| CR-09 | FIXED | analyze.ts now uses `fileURLToPath` |
| CR-10 | FIXED | Model name now configurable via env |
| CR-15 | OPEN | ReDoS risk in SUMMARY_ROW_PATTERN still present |
