# Cycle 39 Architect Review

**Reviewer:** architect
**Focus:** Server/web parity, format diversity gaps, architecture

---

## Finding 1: Server-side PDF parseAmount missing whitespace stripping [BUG-FIX]
- **Severity**: Medium
- **File**: `packages/parser/src/pdf/index.ts:57`
- **Detail**: The server-side PDF `parseAmount` does NOT strip internal whitespace (`\s`), unlike ALL other parseAmount implementations (CSV shared, XLSX, web CSV, web XLSX, web PDF). PDF text extraction can produce amounts with spaces (e.g., "12 345" from column-aligned tables).
- **Impact**: Silent transaction loss for PDF files with whitespace in amounts.

## Finding 2: Server-side PDF tryStructuredParse doesn't report amount parse errors [BUG-FIX]
- **Severity**: Medium
- **File**: `packages/parser/src/pdf/index.ts:190-195`
- **Detail**: `tryStructuredParse` silently skips unparseable amounts without pushing ParseError. ALL other parsers (CSV, XLSX, web PDF, web CSV, web XLSX) report these errors with the message `금액을 해석할 수 없습니다`.
- **Impact**: Silent data loss -- users cannot see which PDF rows had unparseable amounts.

## Finding 3: 7 bank adapters missing test coverage [TEST]
- **Severity**: Low
- **File**: `packages/parser/__tests__/csv-adapters.test.ts`
- **Detail**: suhyup, jb, kwangju, jeju, mg, cu, kdb adapters have zero test coverage.
- **Impact**: Regression risk.

---

## Server/Web Parity Assessment

| Component | Server | Web | Parity |
|-----------|--------|-----|--------|
| Column patterns | 15+ terms/category | Same (synced C38) | OK |
| CSV bank adapters | 24 (factory) | 10 (inline) | D-01 deferred |
| XLSX bank configs | 24 | N/A (column-matcher) | OK |
| PDF parseAmount | **Missing \s strip** | Has \s strip | **BROKEN** |
| PDF error reporting | **Missing errors** | Has errors | **BROKEN** |
| Date parsing | shared | shared | OK |