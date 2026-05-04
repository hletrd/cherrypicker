# Implementation Plan -- Cycle 46

## P1. PDF Merchant Extraction Fallback [HIGH]
**Files**: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
**What**: When "between date and amount" extraction yields empty, add fallback that scans non-date/amount cells for longest Korean-text cell.

## P2. Expand Column Patterns [MEDIUM]
**File**: `packages/parser/src/csv/column-matcher.ts`
**What**: Add missing terms: 사용일|사용일자, 사용처|payee, 매입금액, 할부회수|install, 상세내역 + HEADER_KEYWORDS

## P3. Summary Row Pattern [MEDIUM]
**File**: `packages/parser/src/csv/column-matcher.ts`
**What**: Add 이월잔액|전월이월|이월금액 with boundary guards

## P4. Tests
**File**: `packages/parser/__tests__/table-parser.test.ts`
**What**: Tests for new patterns and summary row edge cases

## Deferred
- D-01: Server/web shared module (architectural)
- D-02: PDF multi-line headers (edge case, deferred)
- D-03: Web CSV 10 hand-rolled adapters -> factory pattern