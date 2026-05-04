# Code Review -- Cycle 21

## Focus: Format diversity, server/web parity, CSV column detection edge cases

### Finding 1: CSV generic isDateLikeShort uses day <= 31 instead of month-aware validation (MEDIUM)

**Files:** `packages/parser/src/csv/generic.ts:37-44`, `apps/web/src/lib/parser/csv.ts:141-148`

Both server-side and web-side generic CSV parsers have `isDateLikeShort()` for column detection heuristics. These validate short dates (MM/DD) using only `day <= 31`, which means impossible dates like "2/31" (Feb 31), "4/31" (Apr 31), "6/31" (Jun 31), "9/31" (Sep 31), "11/31" (Nov 31) would pass validation.

The PDF parsers (both server `packages/parser/src/pdf/index.ts:38-44` and web `apps/web/src/lib/parser/pdf.ts:59-66`) correctly use month-aware `MAX_DAYS_PER_MONTH` validation. The `date-utils.ts` module already exports `daysInMonth()` and `isValidDayForMonth()` for this purpose.

**Impact:** When a headerless CSV is parsed with data-based column inference, an impossible date value like "2/31" in a data cell could cause the parser to misidentify that column as the date column instead of an amount column. While unlikely in real data, the inconsistency with the PDF parsers creates unnecessary divergence.

**Fix:** Replace `day <= 31` with proper month-aware validation using `daysInMonth()` from `date-utils.ts`, matching the PDF parser approach.

### Finding 2: Web XLSX parseAmount missing whitespace stripping (LOW)

**File:** `apps/web/src/lib/parser/xlsx.ts:281`

The web-side XLSX `parseAmount()` strips Won sign and commas but does NOT strip internal whitespace, while:
- Server-side XLSX `parseAmount()` at line 126 DOES strip whitespace (`.replace(/\s/g, '')`)
- Both shared `parseCSVAmount()` DO strip whitespace

**Impact:** Values like "1,234 원" (space before Won suffix) or "1 234" (non-breaking space as thousands separator) would fail to parse on the web side but succeed on the server side. Low severity since SheetJS typically returns clean numeric or string values without embedded whitespace.

**Fix:** Add `.replace(/\s/g, '')` to match server-side behavior.

### Finding 3: Server CSV parseCSVAmount strips whitespace AFTER parenthesized negative check order (LOW)

**File:** `packages/parser/src/csv/shared.ts:37`

Server-side `parseCSVAmount()` strips whitespace after the Won/comma removal, while the parenthesized negative check happens before whitespace stripping. The web-side CSV `parseAmount()` does parenthesized check after all cleaning. Not a real bug (no Korean bank puts spaces inside parentheses), but inconsistent ordering.

**Fix:** Reorder to match other parsers for consistency.

## No Regressions Found

After 20 cycles of improvements, the parser codebase shows consistent behavior across all 6 parsers. Column matching, date parsing, amount parsing, summary row detection, header detection, forward-fill, and bank detection all work correctly and consistently.

## Test Coverage Gaps

- No tests for impossible short dates ("2/31", "4/31") in CSV column detection heuristics
- No tests for whitespace-stripped amounts in XLSX web parser