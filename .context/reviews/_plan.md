# Cycle 95 Implementation Plan

## Goal
Fix keyword/pattern parity bugs in column-matcher.ts and add missing column pattern.

## Plan

### P1: Add missing MERCHANT_KEYWORDS entries (F-95-01, BUG)
**File**: `packages/parser/src/csv/column-matcher.ts`
- Add `구매내용`, `취소가맹점`, `가게` to MERCHANT_KEYWORDS Set

### P2: Add missing CATEGORY_KEYWORDS entries (F-95-02, BUG)
**File**: `packages/parser/src/csv/column-matcher.ts`
- Add `가맹점유형`, `매장유형` to CATEGORY_KEYWORDS Set

### P3: Add "원금" to amount pattern and keywords (F-95-03, FORMAT DIVERSITY)
**File**: `packages/parser/src/csv/column-matcher.ts`
- Add `원금` to AMOUNT_COLUMN_PATTERN regex
- Add `원금` to AMOUNT_KEYWORDS Set

### P4: Quality gates
- bun test
- vitest

## Deferred
- D-01: PDF multi-line header support
- D-02: Shared module refactor for duplicated parseAmount/isValidShortDate