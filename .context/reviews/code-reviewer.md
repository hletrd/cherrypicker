# Code Review -- Cycle 25

## Finding 1: Web-side column-matcher.ts missing cycle 24 keyword and pattern updates [HIGH]

**Location:** `apps/web/src/lib/parser/column-matcher.ts`

**Problem:** Cycle 24 updated the server-side `packages/parser/src/csv/column-matcher.ts` with new keyword Set entries and expanded SUMMARY_ROW_PATTERN, but the corresponding web-side file was NOT updated. This creates a server/web parity regression.

**Missing from web-side:**

| Item | Server-side (current) | Web-side (stale) |
|------|----------------------|------------------|
| `SUMMARY_ROW_PATTERN` | includes `승인\s*합계\|결제\s*합계\|총\s*(?:사용\|이용)` | missing these 3 variants |
| `HEADER_KEYWORDS` | includes `'shop'`, `'price'`, `'won'` | missing these 3 |
| `AMOUNT_KEYWORDS` Set | includes `'price'`, `'won'` | missing these 2 |
| `MERCHANT_KEYWORDS` Set | includes `'shop'` | missing this 1 |

**Impact:**
- Web-side CSV/XLSX parsers accept summary rows like "승인합계 100,000원" as data (false-positive transactions)
- Web-side generic CSV rejects English-only headers like `['Date', 'Shop', 'Price']` (isValidHeaderRow fails)

**Fix:** Sync web-side column-matcher.ts with server-side.

## Finding 2: Missing test coverage for cycle 24 summary and keyword additions [MEDIUM]

**Location:** `packages/parser/__tests__/column-matcher.test.ts`

**Problem:** Cycle 24 added tests for `승인합계`/`결제합계`/`총사용`/`총이용` summary variants (lines 361-374) and English keyword Set completeness (lines 380-409). However, the server-side tests pass while the web-side column-matcher has the drift. No test validates that isValidHeaderRow rejects the new summary variants as headers (only as summary row content).

**Fix:** Add test verifying `isValidHeaderRow(['승인합계', '100,000'])` returns false.

## Previous Cycle Status

Cycle 24 F1 (keyword Set alignment): CONFIRMED FIXED on server-side, but web-side was missed.
Cycle 24 F2 (SUMMARY_ROW_PATTERN expansion): CONFIRMED FIXED on server-side, but web-side was missed.
Cycle 24 F3 (Set completeness tests): CONFIRMED FIXED on server-side.