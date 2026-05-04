# Cycle 30 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 30
**Tests:** 551 bun, 243 vitest

## Summary
2 actionable findings from deep code review of all parser source files with focus on false-positive summary row matching and test coverage gaps.

## Findings

### F1: SUMMARY_ROW_PATTERN false-positive on merchant names (HIGH)

**Impact:** All 6 parsers test SUMMARY_ROW_PATTERN against full-line or joined-row text. Merchant names containing summary keywords (e.g., "합계마트", "소비마트") are silently dropped.

**Files:**
- `packages/parser/src/csv/column-matcher.ts` (server-side source of truth)
- `apps/web/src/lib/parser/column-matcher.ts` (web-side copy, must stay in sync)

**Root cause:** The regex matches keywords as substrings without boundary constraints. "합계" matches inside "합계마트". Also includes overly broad terms "소비" and "이월" that can match merchant names.

### F2: Test gap for summary-row false-positive (MEDIUM)

No tests verify that merchant names containing summary keywords are preserved rather than incorrectly filtered.

## Deferred Items

| ID | Item | Reason |
|----|------|--------|
| D-01 | Server/web CSV parser duplication | Requires shared module architecture refactor |
| D-02 | Full-width digit date parsing | Extremely rare in Korean bank exports |
| D-03 | Date regex end-anchoring | Correct for actual use case (clean cells from splitLine/sheet_to_json) |

## Regressions
None. All 794 tests passing.