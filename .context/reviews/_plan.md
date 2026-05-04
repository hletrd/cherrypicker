# Cycle 66 Implementation Plan

## Priority 1: CSV multi-line quoted field support (F1)
**File**: `packages/parser/src/csv/shared.ts`
- Add `splitCSVContent(content: string, delimiter: string): string[]` that tracks quote state across line breaks
- Normalize CRLF to LF before processing (F7)
- Then split logical lines respecting quoted fields

**File**: `packages/parser/src/csv/index.ts`
- Replace `content.split('\n').filter(l => l.trim())` with `splitCSVContent(cleanContent, delimiter)`

**File**: `packages/parser/src/csv/adapter-factory.ts`
- Replace `content.split('\n').filter(l => l.trim())` with `splitCSVContent(content, delimiter)`

## Priority 2: Strip leading `+` sign in amount parsing (F2)
**File**: `packages/parser/src/csv/shared.ts`
**File**: `packages/parser/src/xlsx/index.ts`
**File**: `packages/parser/src/pdf/index.ts`
- Add `.replace(/^\+/, '')` to amount cleaning after Won/currency stripping

## Priority 3: Adapter-factory skip condition parity (F4)
**File**: `packages/parser/src/csv/adapter-factory.ts`
- Change `if (!dateRaw && !merchantRaw)` to `if (!dateRaw && !merchantRaw && !amountRaw)`

## Priority 4: Add English "subtotal" to SUMMARY_ROW_PATTERN (F8)
**File**: `packages/parser/src/csv/column-matcher.ts`
**File**: `apps/web/src/lib/parser/column-matcher.ts`
- Add `\bsubtotal\b` to SUMMARY_ROW_PATTERN

## Priority 5: Tests
**File**: `packages/parser/__tests__/csv-shared.test.ts`
- Multi-line quoted CSV fields via splitCSVContent
- Leading `+` in amounts via parseCSVAmount
- CRLF line endings via splitCSVContent

## Deferred
- F3 (delimiter detection inside quotes) - low impact
- F5 (PDF multi-line headers) - high complexity, low occurrence
- D-01 (shared module) - architectural refactor