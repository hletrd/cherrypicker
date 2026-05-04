# Cycle 28 Deep Code Review

## Scope
Comprehensive review of all parser source files (server + web) for format diversity, parity, and correctness.

## Baseline
- 534 bun tests passing (packages/parser/__tests__/)
- 242 vitest tests passing (packages/rules/__tests__/)

## Finding 1: normalizeHeader missing NBSP (U+00A0)

**Severity:** Medium | **Category:** Format Diversity

Both `packages/parser/src/csv/column-matcher.ts` and `apps/web/src/lib/parser/column-matcher.ts` strip
invisible Unicode characters from headers via regex:

```
/[​‌‍­　\t\n\r]/g
```

This covers: U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+00AD (soft hyphen), U+3000 (ideographic space),
tab, newline, carriage return.

**Missing: U+00A0 (no-break space).** NBSP commonly appears in Korean bank CSV/XLSX exports when
headers are copied from web pages or formatted in Excel with non-breaking spaces to prevent line wrap.
For example, a header like `이용 금액` would fail to match `이용금액` after normalization because
NBSP is not stripped, causing the whitespace collapse `replace(/\s+/g, '')` to produce `이용 금액`
instead of `이용금액`.

**Fix:** Add ` ` to the character class in `normalizeHeader()` in both server and web copies.

## Finding 2: parseDateStringToISO datetime strings not handled

**Severity:** Medium | **Category:** Format Diversity

Korean bank XLSX and CSV exports commonly include datetime strings like:
- `2024-01-15 10:30:00`
- `2024.01.15 14:20`
- `2024/01/15 오전 10:30`

The `parseDateStringToISO()` function in `packages/parser/src/date-utils.ts` (and web-side
`apps/web/src/lib/parser/date-utils.ts`) uses a regex that matches only the date portion:
`/^(\d{4})[\s]*[.\-\/]...` which stops after `\d{1,2}`. For `2024-01-15 10:30:00`, the regex
captures `2024-01-15` but the extracted string still has the time suffix. Since the function returns
the cleaned-up matched portion (not the full string), this is actually fine for the regex match path.

However, the `YYYYMMDD` compact format check (`/^\d{8}$/`) fails for `20240115 10:30` because the
full string doesn't match the anchored pattern. More critically, if a bank exports `20240115` as a
cell value with trailing text (rare but possible), the check fails.

The primary impact path is through the XLSX parser where `parseDateToISO()` receives cell values
as `unknown`. If the cell is a string like `"2024-01-15 10:30:00"`, it delegates to
`parseDateStringToISO()`. The full-date regex matches `2024-01-15` and returns it correctly. But
for the CSV parser's `isDateLike()` heuristic, the DATE_PATTERNS array uses fully-anchored patterns
like `/^\d{4}[\s]*[.\-\/]...$/` which would NOT match `2024-01-15 10:30:00` because the `$` anchor
requires the string to end immediately after the day digits. This causes datetime cells to fail the
isDateLike check, potentially preventing column inference from working correctly.

**Fix:** Add a datetime-aware pattern to DATE_PATTERNS in both server and web generic CSV parsers.

## Finding 3: Expanded merchant/date column patterns

**Severity:** Low-Medium | **Category:** Format Diversity

The `MERCHANT_COLUMN_PATTERN` regex is missing several Korean terms that appear in alternative
bank exports and non-standard statement formats:
- "판매처" (sales location) — used by some department store card exports
- "구매처" (purchase location) — used interchangeably with "이용처"
- "매장" (store/shop) — used in retail-focused card exports
- "취급처" (handling location) — used by some regional banks

The `DATE_COLUMN_PATTERN` is missing:
- "작성일" (creation date) — used in some bank-generated reports

The `HEADER_KEYWORDS` array and keyword category Sets need corresponding updates for the new terms.

**Fix:** Add new terms to patterns, keywords, and category Sets in both server and web column-matcher.

## No Issues Found

- Server/web parity: After 27 cycles, the remaining known divergences are structural (different
  build systems prevent shared imports). All logic has been verified to be functionally equivalent.
- PDF multi-line header: The current header-aware column detection works for single-row headers.
  Multi-line header support is a deferred architectural item, not a format diversity issue.
- XLSX forward-fill: All columns (date, merchant, category, installments, memo) have consistent
  forward-fill logic on both server and web sides.
- CSV RFC 4180 parsing: Properly handles all delimiters (comma, tab, pipe, semicolon) with
  quote escaping.
- No regressions detected from previous cycle fixes.