# Debugger Review — Cycle 1 (debugger)

## Scope
Full repository review focusing on latent bugs, failure modes, and regressions.

---

## C1-DB-01: Server-side generic CSV parser header detection fails on metadata-heavy files
**Severity: High | Confidence: High**

`packages/parser/src/csv/generic.ts` lines 43-49:
```typescript
for (let i = 0; i < Math.min(5, lines.length); i++) {
  const cells = splitCSVLine(lines[i] ?? '', delimiter);
  const hasNonNumeric = cells.some((c) => /[가-힣a-zA-Z]/.test(c));
  if (hasNonNumeric) {
    headerIdx = i;
    break;
  }
}
```

**Failure scenario**: A KB card CSV export starts with:
```
KB국민카드 이용내역
2024년 1월 ~ 2024년 12월
카드번호: **** **** **** 1234
---
거래일시,가맹점명,이용금액,할부개월,업종
2024-01-15,스타벅스,5500,0,카페
```

Line 0 ("KB국민카드 이용내역") contains Korean text, so it's identified as the header row. But it has no column structure — parsing will fail silently.

The web-side version correctly requires header keywords from 2+ categories.

---

## C1-DB-02: XLSX `parseDateToISO` returns raw number string for invalid serial dates
**Severity: Medium | Confidence: High**

`packages/parser/src/xlsx/index.ts` lines 31-47:
```typescript
if (raw < 1 || raw > 100000) return String(raw);
const date = xlsx.SSF.parse_date_code(raw);
if (date) {
  if (date.m >= 1 && date.m <= 12 && isValidDayForMonth(...)) {
    return formatted date;
  }
  return String(raw); // Invalid date — returns "45234" as-is
}
```

When `parse_date_code` returns a date with invalid month/day, the function returns the raw serial number as a string (e.g., "45234"). This gets passed to `parseDateStringToISO()` which will try to match it against date patterns and fail, returning it unchanged. The transaction will have a non-ISO date string.

**Fix**: Return an empty string or a clearly invalid marker for invalid serial dates, so downstream code can detect and report the issue.

---

## C1-DB-03: PDF `findAmountCell` matches amounts in non-transaction rows
**Severity: Medium | Confidence: Medium**

`packages/parser/src/pdf/index.ts` line 81:
```typescript
function findAmountCell(row: string[]): { idx: number; value: string } | null {
  for (let i = row.length - 1; i >= 0; i--) {
    if (AMOUNT_PATTERN.test((row[i] ?? '').trim())) return { idx: i, value: row[i] ?? '' };
  }
  return null;
}
```

The `AMOUNT_PATTERN = /^-?[\d,]+원?$/` matches any number with optional commas and 원 suffix. This could match:
- Page numbers ("1,234")
- Card numbers if they appear in the row
- Reference numbers

**Fix**: Add additional context checks — the amount cell should be preceded by a date cell in the same row (which `tryStructuredParse` does check), but the fallback line scanner doesn't validate this ordering.

---

## C1-DB-04: CSV `splitCSVLine` trims all fields — may corrupt leading/trailing whitespace in merchant names
**Severity: Low | Confidence: Medium**

`packages/parser/src/csv/shared.ts` line 26: `result.push(current.trim())` — all parsed fields are trimmed. This is correct for most fields, but merchant names with intentional leading/trailing spaces would be corrupted.

**Impact**: Very low — Korean merchant names rarely have intentional whitespace.

---

## C1-DB-05: `inferYear()` in date-utils.ts uses local time, which may differ from statement timezone
**Severity: Low | Confidence: Medium**

`packages/parser/src/date-utils.ts` line 25: `const now = new Date()` uses the server's local time. If the server is in a different timezone than the user, the 3-month look-back heuristic may incorrectly infer the year for dates near year boundaries.

**Impact**: Low — most users run the parser locally, and the 3-month window provides reasonable tolerance.