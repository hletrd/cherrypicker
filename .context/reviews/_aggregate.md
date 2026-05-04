# Cycle 65 Aggregate Review

## Findings (3 actionable, 1 deferred)

### F1: CSV generic bare-integer amount threshold too high (FORMAT DIVERSITY - Medium)
Files:
- `packages/parser/src/csv/generic.ts` line 73: `^\d{8,}원?$`
- `apps/web/src/lib/parser/csv.ts` line 188: `^\d{8,}원?$`

The AMOUNT_PATTERNS used for column detection in the generic CSV parsers require 8+ digits
for bare integers without comma separators. The PDF parser (both server and web) uses 5+ digits
via its AMOUNT_PATTERN regex. This means CSV files with unformatted amounts like "45000" (5 digits,
45,000 won) or "1234567" (7 digits) will NOT be detected as amount columns during the
data-inference fallback path when headers don't match. Lowering to 5 digits aligns with the PDF
parser and covers amounts >= 10,000 won (common for credit card transactions).

The false-positive risk is low because:
1. `^\d{5,}$` requires the ENTIRE cell to be just digits (+ optional 원 suffix)
2. Transaction IDs typically contain non-digit characters (letters, hyphens)
3. The column must pass data-inference across 8 sample rows consistently

### F2: Server adapter-factory missing console.warn on detect failure (PARITY - Low)
File: `packages/parser/src/csv/adapter-factory.ts`
The web-side csv.ts logs `console.warn` when a bank adapter fails during the signature-detect
loop (line 753). The server-side adapter-factory silently continues. Add `console.warn` for parity.

### F3: Silent failure when data-inference detects no columns (UX - Low)
File: `packages/parser/src/csv/generic.ts` lines 149-191
When headers don't match and the data-inference fallback also fails to detect required
columns (date, amount), the parser returns zero transactions with NO error message.
Add an error message when required columns are not found after data-inference.

## Deferred
### D1: PDF multi-line header support
PDFs where header text wraps across 2+ lines remain unsupported. Low frequency, high complexity.