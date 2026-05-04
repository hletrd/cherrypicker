# Cycle 14 Code Review

## Findings

### F-CR-1: XLSX formula error cells not explicitly handled (Medium)
`packages/parser/src/xlsx/index.ts` line 193: `xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })`
With `raw: true`, formula cells producing Excel errors (#VALUE!, #REF!, #DIV/0!, #N/A) return as error strings. `parseAmount` handles these correctly (returns null), but `parseDateToISO` passes them to `parseDateStringToISO` which returns the error string as-is, then `isValidISODate` returns false, producing a generic "날짜를 해석할 수 없습니다" error.

**Fix**: In `parseDateToISO`, detect Excel error strings before string parsing and produce a specific "셀 수식 오류" error message.

### F-CR-2: Server CSV generic parser uses English error messages (Low)
`packages/parser/src/csv/generic.ts` line 57: `errors: [{ message: 'Empty file' }]` and line 167: `message: \`Cannot parse amount: ${amountRaw}\``
All other server-side parsers use Korean messages. These two English messages are inconsistent.

**Fix**: Change to Korean: '빈 파일입니다' and `금액을 해석할 수 없습니다: ${amountRaw}`

### F-CR-3: Web-side `splitLine` duplicates server `splitCSVLine` (Low, deferred)
`apps/web/src/lib/parser/csv.ts` line 24-38: identical to `packages/parser/src/csv/shared.ts` lines 11-29. Already acknowledged in NOTE(C70-04) comment.

### F-CR-4: PDF `extractPages` missing space insertion (Medium)
`packages/parser/src/pdf/extractor.ts` lines 52-76: The `extractPages` function does NOT insert spaces between text items on the same line, unlike `extractPagesFromBuffer` (lines 14-50). This means exported `extractPages` would merge adjacent words.

**Fix**: Add the same space-insertion logic (lastEndX tracking) to `extractPages`.

### F-CR-5: Web PDF text extraction loses positional info (Medium)
`apps/web/src/lib/parser/pdf.ts` line 322: `content.items.map(...).join(' ')`. This space-joins ALL items from a page regardless of their Y position, losing line break information. Unlike server-side which uses Y-coordinate changes for line breaks.

**Fix**: Apply Y-coordinate-based line break detection in web PDF extraction, similar to server-side `extractor.ts`.

### F-CR-6: XLSX `parseAmount` strips whitespace but CSV `parseCSVAmount` also strips (Very Low)
Both handle whitespace correctly. No issue, just noting for completeness.

### F-CR-7: No test coverage for Excel formula error cells (Medium)
No test verifies behavior when an XLSX file contains formula errors. Should add a test with a mock sheet containing #VALUE! cells.

### F-CR-8: PDF table-parser DATE_PATTERN lookahead edge case (Low)
`table-parser.ts` line 3: The negative lookahead `(?![.\-\/\d])` on short date `\d{1,2}[.\-\/]\d{1,2}` prevents matching "3.5" as a date when followed by more digits. This is correct but doesn't prevent matching "3.5" when preceded by a digit (e.g., "123.5"). The lookbehind `(?<![.\d])` handles this.
