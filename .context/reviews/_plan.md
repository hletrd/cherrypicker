# Cycle 33 Implementation Plan

**Source:** Cycle 33 aggregate review (6 findings, 1 deferred)

## Fixes

### F-01: Server-side PDF AMOUNT_PATTERN Won-sign support (HIGH)

**Files:**
- `packages/parser/src/pdf/index.ts` line 23
- `packages/parser/src/pdf/table-parser.ts` line 75

**Changes:**
1. Fix AMOUNT_PATTERN in index.ts to match web-side pattern with separate Won-sign alternations
2. Fix STRICT_AMOUNT_PATTERN in table-parser.ts similarly
3. Both patterns should accept "₩500", "₩1,234", "￦123" etc.

### F-02: Server-side PDF fallback regex Won-sign support (MEDIUM)

**Files:**
- `packages/parser/src/pdf/index.ts` line 293

**Changes:**
1. Add Won-sign alternations to fallbackAmountPattern to match web-side behavior

### F-03: Web-side parseAmount "마이너스" prefix (MEDIUM)

**Files:**
- `apps/web/src/lib/parser/csv.ts` parseAmount function
- `apps/web/src/lib/parser/xlsx.ts` parseAmount function
- `apps/web/src/lib/parser/pdf.ts` parseAmount function

**Changes:**
1. Add "마이너스" prefix handling to all three web-side parseAmount functions, matching server-side parseCSVAmount behavior

### F-04: findColumn combined header support (MEDIUM)

**Files:**
- `packages/parser/src/csv/column-matcher.ts` findColumn function
- `apps/web/src/lib/parser/column-matcher.ts` findColumn function

**Changes:**
1. In findColumn, after normalization, split headers on "/" and "-" delimiters
2. Test each part against the pattern before testing the full header
3. Also update isValidHeaderRow to split on delimiters before keyword matching

### F-05: Web-side PDF cleanup (LOW) — DEFERRED

Deferred to avoid scope creep. Web-side PDF patterns work correctly for their use case.

### F-06: Test coverage (MEDIUM)

**Files:**
- `packages/parser/__tests__/table-parser.test.ts`
- `packages/parser/__tests__/column-matcher.test.ts`
- `packages/parser/__tests__/xlsx.test.ts`

**Test cases:**
- Server-side PDF Won-sign amounts in findAmountCell
- Combined header matching in findColumn
- isValidHeaderRow with combined headers
- "마이너스" prefix in parseCSVAmount (verify existing coverage)

## Deferred

| ID | Item | Reason |
|----|------|--------|
| F-05 | Web PDF pattern cleanup | Low priority, patterns work for their use case |
| D-01 | Web CSV factory refactor | Requires shared module architecture |

## Quality Gates
- `bun test packages/parser/__tests__/`
- `npx vitest run`
- `bun run build`