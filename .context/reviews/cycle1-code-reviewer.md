# Code Review — Cycle 1 (code-reviewer)

## Scope
Full repository review with focus on parser package format diversity.

---

## C1-CR-01: Massive code duplication across 10 bank CSV adapters (packages/parser/src/csv/*.ts)
**Severity: High | Confidence: High**

All 10 bank-specific CSV adapters (hyundai, kb, ibk, woori, samsung, shinhan, lotte, hana, nh, bc) follow an identical template. The only differences are:
1. The `EXPECTED_HEADERS` constant (exact column name strings)
2. The `detect()` regex patterns
3. The header-row detection logic (some use `includes()` pairs, others use `some(EXPECTED_HEADERS.includes)`)

Each adapter is ~70-80 lines of nearly identical code: delimiter detection, header scanning, `indexOf` column mapping, row iteration, amount parsing, date parsing.

**Problem**: Any bug fix or enhancement (e.g., adding BOM stripping, improving header detection) must be replicated across 10 files. The web-side `apps/web/src/lib/parser/csv.ts` duplicates all 10 adapters again (~1030 lines total).

**Fix**: Create a single configurable `BankCSVAdapter` class that takes a `ColumnConfig` and `detect()` function. The 10 adapters become thin config objects. The XLSX adapter index already has `BANK_COLUMN_CONFIGS` — reuse this pattern for CSV.

---

## C1-CR-02: Server-side generic CSV parser is significantly weaker than web-side
**Severity: High | Confidence: High**

`packages/parser/src/csv/generic.ts` vs `apps/web/src/lib/parser/csv.ts`:

| Feature | Server | Web |
|---------|--------|-----|
| Header scan depth | 5 lines | 30 lines |
| Header keyword validation | None (any Korean text) | Requires keywords from 2+ categories |
| BOM stripping | Missing | Present |
| Korean date patterns in `isDateLike()` | 3 patterns | 6 patterns |
| Header regex coverage | Limited (e.g., no 결제일, 승인일, 매출일) | Full coverage matching XLSX |

**Problem**: The server-side generic parser will fail on files with metadata preamble rows (common in Korean bank exports) because it only scans 5 lines and accepts any Korean text as a header indicator.

**Fix**: Port the web-side improvements to the server-side generic parser.

---

## C1-CR-03: Bank-specific CSV adapters use exact `indexOf()` for column matching — brittle
**Severity: High | Confidence: High**

Every bank adapter uses `headers.indexOf('exact string')` for column detection. If a bank changes their export format even slightly (e.g., adding a space, using a synonym, changing casing), the parser silently returns -1 and skips that column.

Examples:
- `headers.indexOf('이용일')` — won't match '이용일 ' (trailing space) or '이용 일' (space inserted)
- `headers.indexOf('이용금액')` — won't match '이용 금액' or '이용금액(원)'

**Fix**: Use the regex-based approach already used in the XLSX parser (`findCol(configName, pattern)`) for CSV adapters too. Normalize headers (trim, collapse whitespace) before matching.

---

## C1-CR-04: Server-side CSV entry point missing BOM stripping
**Severity: Medium | Confidence: High**

`packages/parser/src/csv/index.ts` line 29: `parseCSV(content, bank)` — the content is passed directly from `parseStatement()` in `index.ts` which reads the file as UTF-8 buffer. The buffer-to-string conversion does NOT strip BOM.

The web-side correctly strips BOM at line 969: `const cleanContent = content.replace(/^﻿/, '');`

**Fix**: Add BOM stripping in `packages/parser/src/index.ts` after encoding detection, or in `packages/parser/src/csv/index.ts` before passing to adapters.

---

## C1-CR-05: Generic CSV merchant column inference is fragile
**Severity: Medium | Confidence: High**

`packages/parser/src/csv/generic.ts` lines 85-93:
```typescript
if (dateCol !== -1 && amountCol !== -1 && merchantCol === -1) {
  for (let i = 0; i < headers.length; i++) {
    if (i !== dateCol && i !== amountCol) {
      merchantCol = i;
      break;
    }
  }
}
```

This picks the FIRST column that isn't date or amount as the merchant. If there's an installments column or category column before the merchant column, it will be misidentified as the merchant column.

**Fix**: Use content heuristics — scan sample data rows for text-heavy columns (Korean characters, not numbers) to identify the merchant column.

---

## C1-CR-06: Bank adapter `detect()` methods duplicate patterns from `detect.ts`
**Severity: Medium | Confidence: High**

Each bank adapter's `detect()` method contains the same regex patterns as `BANK_SIGNATURES` in `detect.ts`. For example, hyundai adapter has `/현대카드/`, `/HYUNDAICARD/`, `/hdcard/i` — identical to the signatures.

**Fix**: Reuse `detectBank()` from `detect.ts` in the adapter `detect()` methods, or remove the per-adapter `detect()` entirely and rely on the central detection.

---

## C1-CR-07: `detectCSVDelimiter` edge case — semicolon delimiter not supported
**Severity: Low | Confidence: Medium**

European-style CSV exports sometimes use semicolons as delimiters. The current detection only checks comma, tab, and pipe. While Korean card exports typically use comma or tab, supporting semicolons would improve robustness for edge cases.

**Fix**: Add semicolon to the delimiter candidates.

---

## C1-CR-08: Date column header regex in web generic CSV includes '합계' in amount pattern
**Severity: Low | Confidence: Medium**

`apps/web/src/lib/parser/csv.ts` line 210: The amount column regex includes `합계` (total/sum), which means a "합계" column header could be matched as the amount column. This is a summary column, not a transaction amount column.

**Fix**: Remove `합계` from the amount column regex, or add it to a summary/skip list.