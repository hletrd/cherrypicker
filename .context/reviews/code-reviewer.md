# Cycle 39 Code Review

**Reviewer:** code-reviewer
**Focus:** Code quality, format diversity bugs, consistency

---

## Finding 1: Server-side PDF parseAmount inconsistent with all other parsers [BUG]
- **File**: `packages/parser/src/pdf/index.ts:56-73`
- **Detail**: Missing `.replace(/\s/g, '')` in cleaning chain. Every other parseAmount implementation includes this. PDF text extraction frequently introduces spaces in amounts.

## Finding 2: Server-side PDF tryStructuredParse silent amount failures [BUG]
- **File**: `packages/parser/src/pdf/index.ts:190-195`
- **Detail**: `if (amount === null) continue;` without error reporting. Should match XLSX pattern which pushes `금액을 해석할 수 없습니다` error.

## Finding 3: Missing test coverage for 7 bank adapters [TEST]
- **File**: `packages/parser/__tests__/csv-adapters.test.ts`
- **Detail**: suhyup, jb, kwangju, jeju, mg, cu, kdb have zero coverage.