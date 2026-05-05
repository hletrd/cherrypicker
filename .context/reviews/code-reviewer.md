# Cycle 87 Code Review

## Findings

### F1 (MEDIUM): Missing `desc`, `amt`, `txn` standalone in column patterns
**File**: `packages/parser/src/csv/column-matcher.ts`

The `desc`, `amt`, and `txn` keywords are present in HEADER_KEYWORDS (line 103-104) but NOT in any column pattern regex. This means:
- A CSV/XLSX/PDF file with `desc` as a header column is correctly identified as a valid header row, but `desc` won't be matched to MERCHANT or MEMO column.
- A file with `amt` as a header column won't be matched to AMOUNT.
- A file with `txn` as a header column won't be matched to any role.

**Impact**: Header detection succeeds but column matching fails, producing empty transaction lists with no error message explaining why.

**Fix**: Add `desc` to MERCHANT and MEMO patterns, `amt` to AMOUNT pattern, `txn` to MEMO pattern.

### F2 (LOW): Missing `installment`, `install`, `remark` in HEADER_KEYWORDS
**File**: `packages/parser/src/csv/column-matcher.ts`

INSTALLMENTS_COLUMN_PATTERN includes `^installments?$|^install$/i` and MEMO_COLUMN_PATTERN includes `^remarks?$`, but the corresponding singular forms (`installment`, `install`, `remark`) are not in HEADER_KEYWORDS. A file with these as column headers won't pass the multi-category header validation if these are the only non-amount keywords present.

**Fix**: Add `installment`, `install`, `remark` to HEADER_KEYWORDS.

### F3 (MEDIUM): XLSX numeric YYYYMMDD dates rejected as errors
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`

When an XLSX cell contains a numeric YYYYMMDD date (e.g., 20240115), the `parseDateToISO` function:
1. Sees `raw > 100000` (20240115 > 100000)
2. Pushes error "날짜를 해석할 수 없습니다: 20240115"
3. Returns String(20240115) = "20240115"

The returned "20240115" is NOT a valid ISO date, so the transaction gets a bad date AND a spurious error. The fix should detect YYYYMMDD-formatted numbers (8 digits, 10000000-99991231 range) and parse them before the serial date rejection guard.

**Impact**: Korean bank XLSX exports that store dates as numeric YYYYMMDD values silently produce malformed dates.