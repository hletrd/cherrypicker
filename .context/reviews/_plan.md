# Cycle 30 Implementation Plan

**Source:** `_aggregate.md` (2 findings)

## Fixes

### F1: Tighten SUMMARY_ROW_PATTERN boundary constraints (HIGH)

**Files:**
- `packages/parser/src/csv/column-matcher.ts` line 55
- `apps/web/src/lib/parser/column-matcher.ts` line 50

**Changes:**
1. Add `(?<![가-힣])` negative lookbehind before compound keywords (합계, 총계, 소계, 누계, 잔액, 당월, 명세)
2. Add `(?:[\s,;]|$)` lookahead after standalone keywords to prevent matching before merchant-name continuation
3. Remove "소비" and "이월" — overly broad terms that match plausible merchant names
4. Add `\b` word boundaries around English keywords "total" and "sum"

**Rationale:** Summary keywords at the start of a line/cell are genuine summary markers. Keywords embedded inside merchant names (e.g., "합계마트") are not. The boundary constraints ensure keywords must be preceded by non-Korean text (start-of-string or whitespace) and followed by whitespace/delimiter/end-of-string.

### F2: Add summary-row false-positive regression tests (MEDIUM)

**Files:**
- `packages/parser/__tests__/column-matcher.test.ts`
- `packages/parser/__tests__/csv.test.ts` (if applicable)

**Test cases:**
- "합계마트" as merchant: NOT a summary row
- "소비마트" as merchant: NOT a summary row (after "소비" removal)
- "합계,,,,123456" as line: IS a summary row
- "총 합계" as text: IS a summary row
- "총사용" as text: IS a summary row
- "total" and "sum" as words: IS a summary row

## Quality Gates
- `bun test packages/parser/__tests__/`
- `npx vitest run`
- `bun run build`