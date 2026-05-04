# Code Review -- Cycle 54

## Reviewer: code-reviewer
## Focus: Format diversity edge cases, remaining gaps, regressions

### C54-01: CSV generic AMOUNT_PATTERNS missing fullwidth-minus variant
**Severity:** Low | **Kind:** Format diversity gap

The AMOUNT_PATTERNS arrays in both server (`packages/parser/src/csv/generic.ts`) and web (`apps/web/src/lib/parser/csv.ts`) generic CSV parsers do not include fullwidth-minus (U+FF0D `－`) in their regex patterns. While `parseCSVAmount` correctly normalizes fullwidth-minus before parsing, the column detection heuristics (`isAmountLike()`) use these patterns to identify the amount column. A column containing "－1,234원" would NOT match any AMOUNT_PATTERN, causing the amount column to be missed during data-inference fallback.

**Affected files:**
- `packages/parser/src/csv/generic.ts` (AMOUNT_PATTERNS, line ~77)
- `apps/web/src/lib/parser/csv.ts` (AMOUNT_PATTERNS, line ~191)

**Fix:** Add fullwidth-minus variant `－` to AMOUNT_PATTERNS negative patterns.

### C54-02: CSV generic data-inference scans only 4 sample rows
**Severity:** Low | **Kind:** Robustness

Both server and web generic CSV parsers use `lines.slice(headerIdx + 1, headerIdx + 5)` (4 rows) for column inference when header-based detection fails. For files with sparse early data (blank rows, sub-headers, metadata lines mixed with data), 4 rows may be insufficient to detect date/amount patterns. Increasing to 8 rows provides better coverage without meaningful performance impact.

**Affected files:**
- `packages/parser/src/csv/generic.ts` (sampleRows, line ~157)
- `apps/web/src/lib/parser/csv.ts` (sampleRows, line ~268)

**Fix:** Increase sample from 4 to 8 rows.

### C54-03: No XLSX data-inference fallback when header detection fails
**Severity:** Low | **Kind:** Feature gap (deferred from C53-05)

When XLSX header detection fails (no row matches isValidHeaderRow), the parser returns a "헤더 행을 찾을 수 없습니다" error. Unlike CSV which has data-inference fallback, XLSX has no recovery path. Some unusual XLSX exports may have data without recognizable header rows. Implementing a date/amount column scanner as a fallback would improve format diversity.

**Fix:** Add data-row scanning fallback before returning error. Deferred — requires careful implementation.

### C54-04: Cycle 53 fullwidth tests already present
**Severity:** N/A | **Kind:** Verified

C53-01 fullwidth digit/comma normalization tests were already added in `csv-shared.test.ts` (lines 259-286). No action needed.

### C54-05: All C53 findings verified as fixed
- C53-01: Fullwidth normalization — FIXED (all 6 parseAmount implementations)
- C53-02: PDF daysInMonth — FIXED (both table-parser.ts use shared utility)
- C53-03: HEADER_KEYWORDS memo terms — FIXED (present in column-matcher.ts line 93)

### Parity Check
- Server/web column-matcher: PARITY
- Server/web date-utils: PARITY
- Server/web bank signatures: PARITY (24 banks each)
- Server/web XLSX column configs: PARITY (24 banks each)
- Server/web CSV: Both have 10 hand-written + 14 factory adapters (parity)
- No regressions detected

### Test Coverage
- 826 bun + 265 vitest = 1091 total tests passing
- Fullwidth amount tests present in csv-shared.test.ts
- Combined header tests cover "/" "|" "," "+" "＋" delimiters
- SUMMARY_ROW_PATTERN has boundary guard tests