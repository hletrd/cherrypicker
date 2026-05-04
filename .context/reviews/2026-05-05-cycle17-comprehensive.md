# Cycle 17 Deep Code Review

## Focus Areas
After 16 cycles, the parser is mature. This review focuses on remaining edge cases,
subtle parity gaps, and small format diversity issues that still exist.

---

## Finding F17-01: `normalizeHeader()` misses tab/newline whitespace chars
**Severity**: Medium | **Files**: `packages/parser/src/csv/column-matcher.ts:12`,
  `apps/web/src/lib/parser/column-matcher.ts:16`

The invisible-char regex `[​‌‍­　]` strips zero-width spaces, soft hyphens, and
ideographic spaces, but does NOT include `\t` (U+0009) or `\n` (U+000A). If a
header cell in an XLSX or CSV file contains a tab or newline (common in multiline
XLSX cell values), normalization will leave it in, causing `findColumn` to fail
the exact-match path and rely solely on regex fallback.

**Fix**: Add `\t\n\r` to the character class, OR rely on `.replace(/\s+/g, '')`
which already collapses all whitespace. But the invisible-char strip runs first,
so tabs/newlines won't survive to the `\s+` step if they're mixed with the
existing chars. The real fix is to make the char class broader: `/[​‌‍­　\t\n\r]/g`.

---

## Finding F17-02: PDF summary row pattern missing common variants
**Severity**: Low-Medium | **Files**: `packages/parser/src/pdf/index.ts:153`,
  `packages/parser/src/pdf/index.ts:285`, `apps/web/src/lib/parser/pdf.ts:259,
  `apps/web/src/lib/parser/pdf.ts:494`

The summary/total row skip pattern is `/총\s*합계|합\s*계|총\s*계|소\s*계|합계|총계|소계|total|sum/i`.
Missing common Korean PDF summary variants:
- `누계` (cumulative total)
- `잔액` (balance)
- `이월` (carryover)
- `소비` (spending total)
- `당월` (current month total)
- `명세` (statement total)

These appear in various Korean bank PDF statement footers and would be parsed as
transaction rows with likely incorrect dates/amounts.

---

## Finding F17-03: PDF `fallbackAmountPattern` can false-match card numbers
**Severity**: Low | **Files**: `packages/parser/src/pdf/index.ts:266`,
  `apps/web/src/lib/parser/pdf.ts:488`

The pattern `/( [\d,]+)원?/g` matches any comma-separated digit sequence. This
is fine when paired with a date match, but card number sequences like
`1234,5678,9012,3456` could theoretically match if they appear after a date
on the same line. The structured parser's `AMOUNT_PATTERN` has lookaheads/lookbehinds
to prevent this, but the fallback scanner does not.

---

## Finding F17-04: XLSX summary row detection missing balance/carryover
**Severity**: Low | **Files**: `packages/parser/src/xlsx/index.ts:285`,
  `apps/web/src/lib/parser/xlsx.ts:465`

Same as F17-02 but for XLSX. Missing: `누계`, `잔액`, `이월`, `소비`, `당월`, `명세`.

---

## Finding F17-05: CSV summary row detection missing balance/carryover
**Severity**: Low | **Files**: `packages/parser/src/csv/adapter-factory.ts:118`,
  `packages/parser/src/csv/generic.ts:153`, `apps/web/src/lib/parser/csv.ts:259`

Same as F17-02 but for CSV. The pattern is identical across all parsers and is
missing the same variants.

---

## Finding F17-06: Web CSV `parseAmount()` missing whitespace stripping
**Severity**: Low | **Files**: `apps/web/src/lib/parser/csv.ts:71`

The web-side CSV parseAmount strips whitespace after removing `원` and commas:
`cleaned.replace(/\s/g, '')`. This matches the server-side behavior. However,
the web-side PDF `parseAmount()` at line 249 does NOT strip whitespace. If a
PDF-extracted amount string contains internal spaces (e.g., "1,234 567" from
misaligned column boundaries), the parseFloat will produce `1234` instead of
`1234567`.

Server-side PDF `parseAmount()` at `packages/parser/src/pdf/index.ts:53` also
does not strip whitespace -- parity is maintained but both are wrong.

---

## Finding F17-07: Web PDF `parseDateToISO` missing line index in error reporting
**Severity**: Low | **Files**: `apps/web/src/lib/parser/pdf.ts:235-243`

The web-side PDF `parseDateToISO()` takes `(raw, errors?)` but does not accept
a `lineIdx` parameter. When errors are pushed, they have no `line` number.
The server-side PDF `parseAmount` similarly lacks line tracking. This means
PDF parse errors don't show which row caused the problem. Minor UX issue.

---

## Finding F17-08: Test coverage gap -- tab characters in headers
**Severity**: Low | **Files**: test files

No existing test verifies that `normalizeHeader()` handles tab characters
in header strings. This is the test coverage gap for F17-01.

---

## Finding F17-09: Test coverage gap -- summary row variants
**Severity**: Low | **Files**: test files

No test verifies that summary rows with `누계`, `잔액`, `이월` are skipped.

---

## Finding F17-10: Test coverage gap -- parenthesized negative amounts in PDF fallback
**Severity**: Low | **Files**: test files

The PDF fallback line scanner's `fallbackAmountPattern` does not handle
parenthesized negatives `(1,234)`. The structured parser and all CSV/XLSX
parsers handle this format. This is a format diversity gap in the PDF fallback.

---

## Architecture Status

### Server/Web Parity
The server and web parsers are well-aligned after 16 cycles. Both sides use
the same column-matcher patterns, same header validation, same forward-fill
logic, and same summary row patterns. The remaining gaps (F17-02/04/05/06)
affect both sides equally and should be fixed together.

### Technical Debt
The web-side CSV still maintains 10 hand-coded bank adapters rather than using
the server-side `createBankAdapter()` factory pattern. This was noted in
previous cycles as a D-01 architectural refactor and remains deferred.

### Test Health
725 bun + 232 vitest = 957 total tests, all passing. Good coverage but
specific gaps exist in edge cases (F17-08/09/10).