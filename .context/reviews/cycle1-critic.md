# Multi-Perspective Critic — Cycle 1 (critic)

## Scope
Cross-cutting critique of the parser's format diversity and overall design.

---

## C1-CRIT-01: The parser's primary failure mode is "no transactions found" with no actionable guidance
**Severity: High | Confidence: High**

When parsing fails (wrong header names, different column order, unexpected encoding), the parser returns `{ transactions: [], errors: [{ message: "헤더 행을 찾을 수 없습니다." }] }`. This tells the user WHAT failed but not HOW to fix it.

For a tool designed to handle "diverse file formats," silent failure with no diagnostic information is the worst UX. The parser should report:
- What headers it found vs. what it expected
- Which columns it identified as date/merchant/amount
- Sample data from the first few rows
- Suggestions for format detection

---

## C1-CRIT-02: The adapter pattern is the right architecture but the implementation is too rigid
**Severity: High | Confidence: High**

The bank adapter pattern (detect bank, then use bank-specific parser) is correct. But the implementation uses exact string matching for column names, which makes each adapter a fragile single-point-of-failure for that bank's format.

A better approach: use the adapter pattern for bank-specific BUSINESS LOGIC (which columns to skip, how to handle special rows, bank-specific date formats) but use a shared, flexible column-matching engine for the mechanical work.

---

## C1-CRIT-03: The generic parser is the safety net but it's weaker than the bank-specific parsers
**Severity: Medium | Confidence: High**

When a bank-specific adapter fails, the system falls back to the generic parser. But the generic parser has WEAKER header detection (scans only 5 lines on server, less keyword coverage) than the bank-specific parsers. The safety net has bigger holes than the primary net.

The generic parser should be the BEST parser — it should handle everything the bank-specific parsers handle plus more. Bank-specific adapters should only add bank-specific logic on top.

---

## C1-CRIT-04: Format detection is extension-based first, content-based second
**Severity: Medium | Confidence: Medium**

`packages/parser/src/detect.ts` line 169: `detectFormat()` checks file extension FIRST, then only sniffs content if the extension is unknown. This means a file named `data.txt` that's actually a CSV will be treated as CSV (correct), but a file named `data.csv` that's actually an HTML table exported as CSV (common from Korean banks) won't get HTML-as-XLS treatment.

**Fix**: For .csv files, also check if the content is HTML before treating as plain CSV.

---

## C1-CRIT-05: No statement period extraction from parsed data
**Severity: Low | Confidence: High**

`ParseResult` has `statementPeriod?: { start: string; end: string }` but no parser actually populates it. This field could be inferred from the min/max transaction dates, which would help the optimizer understand the time scope.