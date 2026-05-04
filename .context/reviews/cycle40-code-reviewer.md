# Code Review -- Cycle 40

## Findings

### FINDING-1: Web-side CSV parser missing 14 bank adapters [HIGH]
**File**: `apps/web/src/lib/parser/csv.ts`
The web-side CSV parser has only 10 bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc). The server-side has 24 including kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost. When a web user uploads CSV from these banks, only generic parsing applies.

### FINDING-2: SUMMARY_ROW_PATTERN missing left boundary for some patterns [LOW]
**File**: `packages/parser/src/csv/column-matcher.ts`
Patterns like `승인\s*합계`, `결제\s*합계`, `총\s*(?:사용|이용)` lack `(?<![가-힣])` left boundary, allowing matches inside merchant names. Very unlikely in practice but inconsistent with other patterns.

### FINDING-3: normalizeHeader strips BOM but not ZWJ/variation selectors [LOW]
Both column-matcher.ts files. The regex misses U+FE00-FE0F (variation selectors) that some Unicode-aware editors insert. Exotic edge case.

### FINDING-4: Web-side PDF no-transaction message differs from server-side [LOW]
**Files**: `apps/web/src/lib/parser/pdf.ts` vs `packages/parser/src/pdf/index.ts`
Web returns generic Korean message; server returns structured error about LLM fallback. Inconsistent UX.

## Summary
After 39 cycles the parser is robust. The most impactful remaining issue is FINDING-1 (web-side missing 14 bank adapters). Other findings are cosmetic.
