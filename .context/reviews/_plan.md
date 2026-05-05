# Cycle 86 Implementation Plan

## Goal
Add missing English keywords to HEADER_KEYWORDS, add `할인` to SUMMARY_ROW_PATTERN, and add test coverage for English-only header detection.

## Changes

### 1. Add missing English date keywords to HEADER_KEYWORDS
**File:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
- Add to HEADER_KEYWORDS: `settlementdate`, `paymentdate`, `invoicedate`, `purchasedt`, `purchase_dt`, `transdate`, `transdt`, `transactiondt`, `transaction_dt`, `txndt`, `bookdate`, `canceldate`, `refunddate`

### 2. Add missing English merchant keyword to HEADER_KEYWORDS
**File:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
- Add `name` to HEADER_KEYWORDS

### 3. Add missing English amount keywords to HEADER_KEYWORDS
**File:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
- Add to HEADER_KEYWORDS: `debit`, `credit`, `net`, `netamount`, `gross`

### 4. Add standalone `할인` to SUMMARY_ROW_PATTERN
**File:** `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
- Add `(?<![가-힣])할인(?![가-힣])(?=[\s,;]|$)` pattern for standalone discount summary rows

### 5. Add English-only header detection tests
**File:** `packages/parser/__tests__/column-matcher.test.ts`
- Test `isValidHeaderRow` with English-only header rows
- Test `SUMMARY_ROW_PATTERN` with standalone 할인 rows

### 6. Run all quality gates
- `bun test`
- `vitest`
- `bun run build`

## Deferred Items (STRICT)
- D-01: Shared module between Bun/browser — **deferred** (significant refactor)
- PDF multi-line headers — **deferred** (needs fixture data)
- Historical amount display — **deferred** (low priority)
- Card name suffixes — **deferred** (low priority)
- Global config integration — **deferred** (feature work)
- Generic parser fallback — **deferred** (needs UX decisions)
- CSS dark mode — **deferred** (frontend work)