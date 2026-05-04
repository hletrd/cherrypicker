# Deep Code Review — Cycle 6

## Critical Findings

### C6-01: `isValidHeaderRow` doesn't normalize headers before keyword matching
**Severity: HIGH** — Real-world Korean bank exports commonly use parenthetical suffixes
like "이용금액(원)" or extra whitespace like "이용 금액" in column headers. The
`isValidHeaderRow()` function in `column-matcher.ts` compares raw cell values
against `HEADER_KEYWORDS` using exact Set membership (`catSet.has(c)`). A cell
value of "이용금액(원)" will NOT match the keyword "이용금액", causing header
detection to fail and the entire file to produce zero transactions.

Affected paths:
- `packages/parser/src/csv/column-matcher.ts` — `isValidHeaderRow()`
- All callers: generic CSV, adapter-factory, XLSX parser, web-side CSV

**Fix**: Apply `normalizeHeader()` to each cell before keyword checking.

### C6-02: BOM not stripped in `detectFormat()` before bank detection
**Severity: MEDIUM** — When `detectFormat()` reads a CSV file for bank detection
(line 212 of detect.ts), it passes raw content to `detectBank()` without stripping
the BOM. If a BOM-prefixed file starts with `﻿KB국민카드`, the pattern
`/KB국민카드/` would match (since BOM is zero-width), but `/NH농협/` wouldn't
match `﻿NH농협` because the BOM is between line start and the bank name.
However, since most bank patterns don't anchor to start-of-string, this is
lower-severity than C6-01. Still worth fixing for consistency.

**Fix**: Strip BOM in `detectFormat()` before calling `detectBank()`.

### C6-03: XLSX parser doesn't handle Date objects from SheetJS
**Severity: MEDIUM** — When SheetJS reads XLSX files with `cellDates: false` (which
is the current setting), dates come as serial numbers. But if `cellDates: true`
were used (or if some edge case returns Date objects), `parseDateToISO()` would
fall through to the `String(raw)` path producing something like
"Thu Feb 01 2024 00:00:00 GMT+0900" which won't parse. The current code handles
numbers and strings but not `Date` objects. Since `cellDates: false` is used,
this is defensive hardening.

### C6-04: Generic CSV parser Korean text merchant inference skips -1 columns
**Severity: LOW** — In `generic.ts` line 118, the merchant inference loop uses
`i !== dateCol && i !== amountCol && i !== installmentsCol && i !== categoryCol && i !== memoCol`.
When any of these are -1, the condition `i !== -1` is always true for valid column
indices, so it's harmless. But the web-side version uses a `Set` for reserved
columns which is cleaner.

### C6-05: Amount parsing doesn't handle Won sign prefix
**Severity: LOW** — Some Korean bank exports use "₩6,500" format. Current parsers
strip "원" suffix and commas but don't strip "₩" or "￦" prefix.

### C6-06: Date patterns miss some real formats
**Severity: LOW** — Some banks use "2024/01/15 오전 12:00:00" or "2024-01-15 00:00"
datetime format. The current `parseDateStringToISO` regex would match the date
portion via the full match regex since it uses a non-anchored pattern with `\s`
as separator, but the datetime suffix could interfere. Let me check... the regex
is `^(\d{4})[.\-\/\s](\d{1,2})[.\-\/\s](\d{1,2})` which is non-anchored at
end, so "2024-01-15 00:00" would match as "2024-01-15". This is actually fine.
But "2024.01.15 오후 2:30:00" would also work because the regex captures just
the date part. OK, this is fine.

### C6-07: PDF extractor uses deprecated pdf-parse
**Severity: LOW (not actionable this cycle)** — `pdf-parse` hasn't been updated
since 2020. The `unpdf` package is also a dependency. This is a deferred item.

### C6-08: XLSX forward-fill applies to rows even with all-empty cells
**Severity: LOW** — Line 253: `if (row.every((c) => !c)) continue;` — this skips
rows where ALL cells are empty. But if a row has only one non-empty cell in a
non-tracked column (e.g., a memo column), it would still proceed with forward-
filled date/merchant from previous rows, potentially creating spurious
transactions. However, the `if (!dateRaw && !merchantRaw) continue;` check on
line 286 catches this since both would be forward-filled. Wait, they would be
forward-filled from the last valid row, so this could create phantom transactions
from cells that aren't actual transactions.

Actually, looking more carefully: if `dateCol` is not -1, the `dateRaw` will
always have a value from forward-fill after the first data row. Same for
merchant. So ANY non-empty cell in ANY column after the first data row would
produce a transaction as long as amount parses. This is a real issue but hard
to fix without more context about what constitutes a "real" data row. This is
deferred.

## Format Diversity Assessment

### CSV Robustness: GOOD
- BOM stripping: handled in parseCSV entry point
- Delimiter detection: comma, tab, pipe, semicolon
- Header detection: up to 30 rows scanned, multi-category validation
- Column matching: exact + regex fallback via ColumnMatcher
- Amount parsing: commas, 원 suffix, parenthesized negatives
- Summary row filtering: 합계/총계/소계/total/sum
- Bank detection: 24 bank signatures

### XLSX Robustness: GOOD with gaps
- Multi-sheet: selects sheet with most transactions
- HTML-as-XLS: detected and normalized
- Serial dates: handled with validation
- Merged cells: forward-fill for date/merchant/category
- **GAP**: isValidHeaderRow doesn't normalize (C6-01)
- **GAP**: No Date object handling (C6-03)

### PDF Robustness: ADEQUATE
- 3-tier parsing: structured table → line scanner → LLM fallback
- Column boundary detection from whitespace analysis
- Date/amount cell finding
- **GAP**: No multi-line header support (deferred from cycle 4)

### Encoding: BASIC
- CP949 fallback when UTF-8 has too many replacement characters
- **GAP**: No proper encoding detection library (deferred)