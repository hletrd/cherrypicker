# Plan 36 — High-Priority Fixes (Cycle 21)

**Priority:** HIGH
**Findings addressed:** C21-05
**Status:** TODO

---

## Task 1: Fix PDF `parseTable` early exit on blank lines within tables (C21-05)

**Finding:** C21-05 — The `parseTable` function breaks out of table collection when `inTable && !line.trim()` and `tableLines.length > 3`. This means if a PDF has a blank line within a table (e.g., between sections of transactions), parsing stops prematurely. Korean credit card PDFs sometimes have section headers or blank separator lines between monthly groups.

**File:** `apps/web/src/lib/parser/pdf.ts:82-85`

**Implementation:**

Replace the early break on a single blank line with a counter that only breaks after 2+ consecutive blank lines:

```ts
// Track consecutive blank lines instead of breaking on the first one
let consecutiveBlankLines = 0;

for (const line of lines) {
  const hasDate = DATE_PATTERN.test(line);
  const hasAmount = AMOUNT_PATTERN.test(line);

  if (hasDate || hasAmount) {
    inTable = true;
    consecutiveBlankLines = 0;
  }

  if (inTable && line.trim()) {
    tableLines.push(line);
    consecutiveBlankLines = 0;
  } else if (inTable && !line.trim()) {
    consecutiveBlankLines++;
    // Only break after 2+ consecutive blank lines (indicates end of table,
    // not a gap within the table)
    if (consecutiveBlankLines >= 2 && tableLines.length > 3) break;
  }
}
```

**Verification:** Parse a PDF with blank lines between transaction groups. All transactions should be captured, not just those before the first blank line.

**Commit:** `fix(parser): 🐛 prevent early exit in PDF table parser on blank lines within tables`

---

## Progress

- [x] Task 1: Fix PDF parseTable early exit
