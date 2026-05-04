# Cycle 73 Deep Review - Aggregate Findings

## F1: XLSX amount column missing forward-fill [MEDIUM - FORMAT DIVERSITY]
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`
The XLSX parsers forward-fill date, merchant, category, installments, and memo columns for merged cells, but NOT the amount column. Some Korean bank XLSX exports merge amount cells across installment sub-rows (only first row has value). To prevent false fills on legitimately empty cells, forward-fill should be limited to whitespace-only cells (common artifact from merged cells).

## F2: XLSX forward-fill treats whitespace-only cells as non-empty [LOW - FORMAT DIVERSITY]
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`
The forward-fill condition `rawValue !== '' && rawValue != null` does not account for cells containing only whitespace. `String(cell)` for a whitespace cell is "  " which is truthy. These cells should be treated as empty to prevent whitespace artifacts from contaminating forward-fill state.

## F3: Missing column header keywords for Korean bank exports [MEDIUM - FORMAT DIVERSITY]
**File**: `packages/parser/src/csv/column-matcher.ts`
Several column header terms are missing from the pattern constants:
- Amount: "환급금액", "입금금액" (refund/deposit amount variants)
- Memo: "카드명" (card name), "이용카드" (card used) - common in PDF exports
- Date: "이용시간" (usage time) - some banks use this instead of 이용일
- English: "debit", "credit", "net", "recipient", "outlet", "trans_date", "book_date"

## F4: XLSX parseAmount missing EXCEL_ERROR_PATTERN check [LOW - QUALITY]
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`
The `parseDateToISO` function detects Excel formula errors (#REF!, #VALUE!, etc.) and produces specific "셀 수식 오류" messages, but `parseAmount` does not. Formula errors in the amount column produce generic "금액을 해석할 수 없습니다" instead of specific messages.

## F5: PDF multi-line headers not handled [DEFERRED]
**Files**: `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
Some PDF tables have headers spanning multiple lines. Current parser detects only single-line headers. Architecturally complex, deferred.

## Summary
- **Actionable this cycle**: F1, F2, F3, F4
- **Deferred**: F5 (multi-line PDF headers)
- **No regressions detected**
- **Server/web parity**: Good - both sides maintain consistent behavior
- **Test baseline**: 1035 tests passing (bun), 0 failures
