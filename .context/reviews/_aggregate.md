# Cycle 25 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 25
**Tests:** 734+ bun, 231+ vitest

## Actionable Findings (2)

| ID | Severity | Category | Finding | File |
|---|----------|----------|---------|------|
| F1 | HIGH | Server/Web Parity | Web-side column-matcher.ts missing cycle 24 updates: SUMMARY_ROW_PATTERN lacks `승인합계`/`결제합계`/`총사용`/`총이용`; HEADER_KEYWORDS lacks `'shop'`/`'price'`/`'won'`; AMOUNT_KEYWORDS lacks `'price'`/`'won'`; MERCHANT_KEYWORDS lacks `'shop'` | `apps/web/src/lib/parser/column-matcher.ts` |
| F2 | MEDIUM | Test Coverage | No test that `isValidHeaderRow` rejects new summary variants like `['승인합계', '100,000']` as headers | `packages/parser/__tests__/column-matcher.test.ts` |

## Previous Cycle Status

- Cycle 24 F1 (keyword Set alignment on server): **CONFIRMED FIXED**, but web-side was missed
- Cycle 24 F2 (SUMMARY_ROW_PATTERN on server): **CONFIRMED FIXED**, but web-side was missed
- Cycle 24 F3 (Set completeness tests): **CONFIRMED FIXED**

## Assessment

After 25 cycles, the main finding is a server/web parity regression from cycle 24. The server-side fixes for keyword Sets and summary patterns were not ported to the web-side column-matcher. This causes the web parser to accept Korean summary rows as data and reject English-only headers.