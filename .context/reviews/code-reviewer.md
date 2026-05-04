# Code Review -- Cycle 23

## Finding 1: Web-side CSV bank adapters missing summary row skip [HIGH]

**Location:** `apps/web/src/lib/parser/csv.ts` -- all 10 bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc)

**Problem:** The server-side `packages/parser/src/csv/adapter-factory.ts` line 119 has:
```ts
if (SUMMARY_ROW_PATTERN.test(line)) continue;
```

But none of the 10 web-side bank adapters in `csv.ts` include this check. They only skip empty lines with `if (!line.trim()) continue;`.

**Impact:** Summary/total rows like "총 합계,,6000" or "소 계,,45000" will be parsed as real transactions on the web side for bank-specific adapters. The generic parser correctly handles this, but bank-specific paths will produce inflated totals.

**Severity:** High -- affects all web-side bank-specific CSV parsing with summary rows.

## Finding 2: Server-side PDF table-parser DATE_PATTERN short date missing full-width dot variants [MEDIUM]

**Location:** `packages/parser/src/pdf/table-parser.ts` line 3

**Problem:** The DATE_PATTERN short-date branch uses:
```
(?<![.\d])\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d])
```

But the web-side `apps/web/src/lib/parser/pdf.ts` line 33 correctly uses:
```
(?<![.\d．。])\d{1,2}[.\-\/．。]\d{1,2}(?![.\-\/\d．。])
```

The server-side lookbehind and lookahead are missing `．` (U+FF0E full-width dot) and `。` (U+3002 ideographic full stop). This was introduced in cycle 22 when full-width dot support was added to the web-side but the server-side table-parser was missed.

**Impact:** PDFs containing full-width dots in short dates may have incorrect date boundary detection on the server side.

## Finding 3: No integration test for full-width dot dates through CSV/PDF parsers [LOW]

**Location:** `packages/parser/__tests__/`

**Problem:** `date-utils.test.ts` tests full-width dot and ideographic full stop parsing, but no CSV or PDF integration tests verify these formats work end-to-end through the actual parse pipeline.

## No regressions detected. 504 bun tests passing.