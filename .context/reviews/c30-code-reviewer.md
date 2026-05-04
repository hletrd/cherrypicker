# Cycle 30 Deep Code Review — Parser Format Diversity

## Reviewer: code-reviewer
## Focus: Format diversity, false positives, test coverage gaps

---

### Finding 1: SUMMARY_ROW_PATTERN false-positive on merchant names (HIGH)

**File:** `packages/parser/src/csv/column-matcher.ts` line 55

The `SUMMARY_ROW_PATTERN` matches Korean summary keywords as substrings within merchant names. When tested against full line text (CSV, PDF) or joined row text (XLSX), a legitimate transaction with merchant "합계마트" or "소비마트" would be incorrectly skipped.

**Current pattern:**
```
/총\s*합계|합\s*계|총\s*계|소\s*계|합계|총계|소계|누계|잔액|이월|소비|당월|명세|승인\s*합계|결제\s*합계|총\s*(?:사용|이용)|total|sum/i
```

**Problems:**
1. "합계" matches inside "합계마트" (a merchant name)
2. "소비" (consumption) is overly broad — "소비마트" is a plausible merchant name
3. "이월" (carry-forward) could appear in merchant names
4. Keywords need boundary constraints to avoid substring matches

**Usage context — all 6 parsers test against full-line/full-row text:**
- Server CSV (adapter-factory.ts:119): `SUMMARY_ROW_PATTERN.test(line)`
- Server CSV (generic.ts:172): `SUMMARY_ROW_PATTERN.test(line)`
- Server XLSX (xlsx/index.ts:286): `SUMMARY_ROW_PATTERN.test(rowText)` where rowText = joined cells
- Server PDF (pdf/index.ts:110): `SUMMARY_ROW_PATTERN.test(rowText)` where rowText = joined row
- Web CSV (csv.ts:271): `SUMMARY_ROW_PATTERN.test(line)`
- Web XLSX (xlsx.ts:466): `SUMMARY_ROW_PATTERN.test(rowText)`
- Web PDF (pdf.ts:320): `SUMMARY_ROW_PATTERN.test(rowText)`

---

### Finding 2: Test gap — no summary-row false-positive coverage (MEDIUM)

**File:** `packages/parser/__tests__/csv.test.ts`, `table-parser.test.ts`

No existing tests verify that merchant names containing summary keywords (e.g., "합계마트", "소비마트") are preserved rather than incorrectly filtered. This is the exact failure mode that Finding 1 creates.

---

### Finding 3: Server/web CSV parser code duplication persists (LOW — DEFERRED)

**Files:**
- `apps/web/src/lib/parser/csv.ts` — 10 hand-written bank adapters (1099 lines)
- `packages/parser/src/csv/adapter-factory.ts` — factory pattern (265 lines)

The web-side CSV parser still duplicates all bank adapter logic instead of using the server-side adapter factory. The D-01 architectural refactor (shared module between Bun and browser) remains the solution. Not actionable in this cycle.

---

### Finding 4: Full-width digit handling in date parsing (LOW — DEFERRED)

OCR'd Korean PDFs occasionally produce full-width digits (U+FF10-U+FF19: ０１２３). `parseDateStringToISO` does not handle these. Extremely rare in practice; all known Korean bank exports use ASCII digits.

---

### Finding 5: `parseDateStringToISO` regex not end-anchored (LOW — ACCEPTED)

The fullMatch regex `/^(\d{4})[\s]*[.\-\/].../` is start-anchored but not end-anchored, allowing matches on strings like "2024-01-1500" → "2024-01-15". In practice, CSV/XLSX parsing provides clean cells from `splitCSVLine`/`sheet_to_json`, and the PDF parser extracts date values from pre-split table cells. The behavior is correct for the use case.

---

### Parity Check: Server vs Web

| Area | Status | Notes |
|------|--------|-------|
| column-matcher.ts | PARITY | Same source imported by both |
| date-utils.ts | PARITY | Identical implementations |
| detect.ts | PARITY | Identical signatures and logic |
| XLSX parser | PARITY | Same logic, different I/O (File vs ArrayBuffer) |
| PDF parser | PARITY | Same structured+fallback logic |
| CSV parser | DIVERGENT | Web has 10 manual adapters; server uses factory |

---

### Regression Check

No regressions detected. All existing patterns, column matchers, and parser flows are stable.