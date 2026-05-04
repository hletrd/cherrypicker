# Cycle 31 Implementation Plan

**Source:** `_aggregate.md` (3 findings)

## Fixes

### F1: Expand AMOUNT_COLUMN_PATTERN with missing bank amount keywords (HIGH)

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 46
- `apps/web/src/lib/parser/column-matcher.ts` line 42

**Changes:**
1. Add `취소금액|환불금액|입금액|결제액` to AMOUNT_COLUMN_PATTERN regex
2. Add `취소금액`, `환불금액`, `입금액`, `결제액` to AMOUNT_KEYWORDS Set
3. Add same keywords to HEADER_KEYWORDS array

**Rationale:** Many Korean banks use alternative amount column names. "취소금액" (cancel amount) and "환불금액" (refund amount) appear in detailed statement exports. "결제액" is a shorter form used by some banks. These are critical for parsing diverse file formats.

### F2: Expand CATEGORY_COLUMN_PATTERN with bank-variant keywords (MEDIUM)

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 48
- `apps/web/src/lib/parser/column-matcher.ts` line 44

**Changes:**
1. Add `거래유형|결제유형|이용구분|구분|가맹점유형` to CATEGORY_COLUMN_PATTERN regex
2. Add `구분` to HEADER_KEYWORDS (needed for isValidHeaderRow keyword matching)

**Rationale:** Some banks categorize transactions by "type" rather than "category". "거래유형" and "결제유형" are common in bank statement exports. "이용구분" differentiates online/offline usage. These keywords help detect category columns in diverse CSV formats.

### F3: Add tests for expanded column patterns (MEDIUM)

**Files:**
- `packages/parser/__tests__/column-matcher.test.ts`

**Test cases:**
- AMOUNT_COLUMN_PATTERN matches: 취소금액, 환불금액, 입금액, 결제액
- CATEGORY_COLUMN_PATTERN matches: 거래유형, 결제유형, 이용구분, 구분, 가맹점유형
- isValidHeaderRow with new keywords
- findColumn with new keywords

## Quality Gates
- `bun test packages/parser/__tests__/`
- `npx vitest run`
- `bun run build`