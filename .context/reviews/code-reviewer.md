# Code Review -- Cycle 43

## Scope
Full parser package deep review after 42 cycles of improvements.
703 bun tests + 252 vitest tests — all passing.

## Findings

### F1. findColumn exact-match path skips combined-header splitting [MEDIUM]
**File:** `packages/parser/src/csv/column-matcher.ts:29-34`
**File:** `apps/web/src/lib/parser/column-matcher.ts:26-30`

When `exactName` is provided (e.g., `'이용일'`), the first pass does exact normalized match only. If the header is `"이용일/승인일"` (combined), `normalizeHeader("이용일/승인일")` = `"이용일/승인일"` which does NOT equal `"이용일"`. The regex fallback (second pass) catches this via the `/` split, but the exact-name path is wasted work and inconsistent with the regex path.

**Fix:** Also split on `/` in the exact-match path to test each part individually.

### F2. Web CSV: 10 hand-rolled adapters duplicate factory pattern [HIGH — technical debt]
**File:** `apps/web/src/lib/parser/csv.ts:322-1019`

The web CSV file has 10 hand-rolled bank adapters (samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc) that are essentially identical except for column names. Lines 1022-1243 already use a `createBankAdapter` factory for the remaining 14 banks. Refactoring the 10 adapters to use the factory would eliminate ~700 lines of duplication and bring parity with the server-side adapter-factory.ts pattern.

### F3. Server XLSX header detection lacks non-numeric guard [LOW]
**File:** `packages/parser/src/xlsx/index.ts:239-247`

The server XLSX parser calls `isValidHeaderRow(rowStrings)` directly. The CSV generic parser has an additional `hasNonNumeric` guard to prevent purely-numeric rows from passing. The XLSX parser lacks this guard. Low risk since `isValidHeaderRow` requires Korean/English keywords.

### F4. PDF: AMOUNT_PATTERN inconsistency between table-parser and index.ts [LOW]
**File:** `packages/parser/src/pdf/table-parser.ts:14`
**File:** `packages/parser/src/pdf/index.ts:23`

Two different regexes with slightly different behaviors. Table detection is permissive (allows bare amounts of any digit count after comma), while cell extraction is strict (requires Won sign or 5+ digits). Intentional but undocumented.

### F5. CSV: No test for tab-separated files with quoted fields containing tabs [LOW]
`splitCSVLine` handles this per RFC 4180 but no test exercises it.

## Regressions
None detected. All 703 + 252 tests pass.

## Summary
The parser is in excellent shape. Most impactful remaining improvement is F2 (web CSV factory refactor, ~700 lines of elimination) and F1 (exact-match combined-header handling).