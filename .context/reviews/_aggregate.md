# Cycle 39 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 39
**Tests:** 683 bun (baseline)
**Reviewer:** Cycle 39 inline deep scan (PDF parity + test coverage focus)

---

## Finding 1: Server-side PDF parseAmount missing whitespace stripping [BUG-FIX]
- **Severity**: Medium
- **File**: `packages/parser/src/pdf/index.ts:57`
- **Detail**: Missing `.replace(/\s/g, '')` in cleaning chain. ALL other 5 parseAmount implementations include this. PDF text extraction can produce amounts with spaces (e.g., "12 345").
- **Impact**: Silent transaction loss for PDF files with whitespace in amounts.

## Finding 2: Server-side PDF tryStructuredParse doesn't report amount parse errors [BUG-FIX]
- **Severity**: Medium
- **File**: `packages/parser/src/pdf/index.ts:190-195`
- **Detail**: `if (amount === null) continue;` without pushing ParseError. ALL other parsers report unparseable amounts. The fallback scanner in the same file also has this issue at line 326.
- **Impact**: Silent data loss -- users cannot identify which PDF rows had parse failures.

## Finding 3: 7 bank adapters missing test coverage [TEST]
- **Severity**: Low
- **File**: `packages/parser/__tests__/csv-adapters.test.ts`
- **Detail**: suhyup, jb, kwangju, jeju, mg, cu, kdb adapters have zero test coverage. The other 7 new adapters (kakao, toss, kbank, bnk, dgb, sc, epost) were tested in C37-02.
- **Impact**: Regression risk.

---

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV adapter factory refactor (14 missing banks) | Architecture refactor |
| D-02 | PDF multi-line header support | Complex, low ROI |
| D-03 | Server/web CSV parser dedup | Architecture refactor |