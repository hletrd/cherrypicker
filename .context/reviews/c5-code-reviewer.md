# Cycle 5 Code Review — Parser Format Diversity

## Focus: Remaining format diversity issues after 4 cycles

### FINDINGS

#### F1 — Server XLSX: Invalid serial dates produce silent string fallback (MEDIUM)
**File:** `packages/parser/src/xlsx/index.ts` lines 40-63
**Issue:** When parseDateToISO receives a numeric serial date that resolves to an invalid date (e.g., Feb 31), it returns String(raw) without adding an error. The web-side parser reports these as parse errors. Server-side parseDateToISO does not accept an errors parameter.
**Impact:** Users see raw numeric strings in the date field with no indication of failure.
**Fix:** Add optional errors/lineIdx parameters to server XLSX parseDateToISO.

#### F2 — detectFormat reads file twice for CSV bank detection (LOW)
**File:** `packages/parser/src/detect.ts` lines 207-211
**Issue:** For CSV files, detectFormat reads the file once for magic-byte sniffing, then reads again to detect the bank.
**Fix:** Pass the already-read buffer to the bank detection path.

#### F3 — Server XLSX: No merged cell forward-fill for non-date columns (MEDIUM)
**File:** `packages/parser/src/xlsx/index.ts` lines 220-235
**Issue:** Only the date column has forward-fill logic for merged cells. Korean bank XLSX exports may also merge merchant, category, or installments cells across installment groups.
**Fix:** Extend forward-fill to merchant and category columns.

#### F4 — Web generic CSV: merchant column heuristic is weaker than server-side (LOW)
**File:** `apps/web/src/lib/parser/csv.ts` lines 215-222
**Issue:** The web-side generic CSV parser merchant column fallback just picks the first non-date/non-amount column. Server-side checks for Korean text first.

#### F5 — Missing test fixtures for real-world variations (MEDIUM)
**Issue:** No test fixtures for XLSX with serial dates, merged cells in non-date columns, extra whitespace in headers, etc.

#### F6 — ColumnMatcher normalizeHeader strips all parenthetical content (LOW)
**File:** packages/parser/src/csv/column-matcher.ts line 10

#### F7 — Server PDF fallback line scanner misses multi-line transactions (LOW)
**File:** packages/parser/src/pdf/index.ts lines 186-229

#### F8 — XLSX: Time-of-day stripped from datetime cells (LOW)
**Issue:** Some banks include time in datetime cells. Parser strips time entirely.

#### F9 — CSV BOM stripping: no trimming of leading whitespace after BOM (LOW)
**File:** packages/parser/src/csv/index.ts line 36

#### F10 — Server parseStatement CP949 fallback heuristic (LOW)
**File:** packages/parser/src/index.ts lines 39-52
