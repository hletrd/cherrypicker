# Cycle 2 Code Review — Code Quality, Logic, SOLID, Maintainability

## Review Scope
Full repository with special focus on packages/parser/ and apps/web/src/lib/parser/.

---

## F-CR-01: Server-side XLSX parser does not use ColumnMatcher (inline regexes drift risk)
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 193-198

The server-side XLSX parser has its own `findCol()` function with inline regex patterns for column matching. The cycle 1 work created `column-matcher.ts` with shared pattern constants (`DATE_COLUMN_PATTERN`, `MERCHANT_COLUMN_PATTERN`, etc.) that are used by the CSV adapter-factory, but the XLSX parser duplicates these patterns inline. If a pattern is updated in one place, the other drifts silently.

The web-side XLSX parser (`apps/web/src/lib/parser/xlsx.ts` lines 411-416) has the same issue with its own inline regexes.

**Impact**: Pattern divergence between CSV and XLSX parsers — a date format handled by the CSV parser may not be recognized by the XLSX parser.

---

## F-CR-02: Server-side adapter-factory header detection is weaker than generic parser
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/csv/adapter-factory.ts` line 79

The adapter-factory's header detection only checks `cells.some((c) => headerKeywords.includes(c.trim()))` — a single keyword match suffices. The generic CSV parser (both server and web) requires keywords from at least 2 distinct categories (date, merchant, amount). This means the adapter-factory can incorrectly identify a summary row or metadata row as the header if it contains any single bank-specific keyword like '이용금액'.

**Failure scenario**: A Samsung CSV with a summary row containing only '이용금액' before the real header would be misidentified as the header row.

---

## F-CR-03: Server-side XLSX returns first sheet with transactions, not the best
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 106-116

The server-side XLSX parser returns the first sheet that yields any transactions. The web-side parser (`xlsx.ts` lines 314-328) correctly selects the sheet with the MOST transactions. For multi-sheet workbooks where a summary sheet appears first and has fewer transactions, the server-side would return the wrong sheet.

---

## F-CR-04: Unused `isValidCSVAmount` export from shared.ts
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/shared.ts` lines 51-65, `packages/parser/src/csv/adapter-factory.ts` lines 110-117

`isValidCSVAmount` is exported from shared.ts but the adapter-factory has inline null/negative checking instead. This creates two code paths that could diverge. The adapter-factory should use the shared helper for consistency with the generic CSV parser.

---

## F-CR-05: Web-side CSV adapters use exact `indexOf()` — cycle 1 deferred item still unresolved
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts` lines 318-321, 383-387, 449-453, etc.

All 10 web-side bank CSV adapters use `headers.indexOf('exact string')` for column matching. The server-side was fixed in cycle 1 with ColumnMatcher + adapter-factory, but the web-side was deferred. This means the web-side is still brittle against column name variations (trailing spaces, parenthetical suffixes like '이용금액(원)', alternative names).

**Impact**: A user uploading a CSV with column name variations in the browser will get zero transactions while the CLI parser works correctly.

---

## F-CR-06: `parseAmount` in web-side csv.ts has different whitespace handling than server-side
**Severity: Low | Confidence: Medium**
**File**: `apps/web/src/lib/parser/csv.ts` line 56 vs `packages/parser/src/csv/shared.ts` line 36

Both handle whitespace, but the web-side strips whitespace AFTER removing '원' and commas, while the server-side removes '원', commas, AND whitespace in one chained replace. The web-side also doesn't strip whitespace from the raw input before checking for parenthesized negatives. Both work for typical inputs, but edge cases with spaces inside parens like "( 1,234 )" would behave differently.

---

## F-CR-07: Server-side `detectFormat` only reports bank for CSV format
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/detect.ts` lines 206-214

The `detectFormat` function returns `{ bank: null, confidence: 0 }` for XLSX and PDF formats. Bank detection for those formats happens inside the individual parsers. This means callers of `detectFormat` cannot know the bank for XLSX/PDF files without invoking the full parser. The CLI tool or web app might want to display the detected bank before parsing.

---

## F-CR-08: `splitCSVLine` in shared.ts only handles RFC 4180 for comma delimiter
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/shared.ts` lines 9-10

For non-comma delimiters (tab, pipe, semicolon), the function falls back to simple `line.split(delimiter).map(v => v.trim())`. This doesn't handle quoted fields containing the delimiter character (e.g., a semicolon inside a quoted field for semicolon-delimited files). While uncommon for Korean credit card exports, this is a correctness gap.

---

## F-CR-09: Bank adapter `detect()` methods duplicate detection patterns
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/adapter-factory.ts` lines 63-66

The adapter-factory's `detect()` method correctly delegates to `detectBank()` from `detect.ts`. However, the web-side adapters in `csv.ts` have their own inline regex patterns (e.g., line 291: `/삼성카드/.test(content) || /SAMSUNG\s*CARD/i.test(content)`). This duplicates the BANK_SIGNATURES from detect.ts and can drift.

---

## F-CR-10: Server-side `parseCSVAmount` and web-side `parseAmount` have divergent behavior
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/csv/shared.ts` line 36 vs `apps/web/src/lib/parser/csv.ts` line 52

The server-side shared parser strips '원' suffix and commas before checking for parenthesized negatives. The web-side checks for parens first, then strips. While both produce correct results for typical inputs, the server-side is more robust because it strips formatting before parsing.