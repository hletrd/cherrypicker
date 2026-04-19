# Plan 45: Fix misleading "50만원으로 계산해요" UI text in FileDropzone (Cycle 38)

**Finding:** C38-01
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/components/upload/FileDropzone.svelte:409`

## Problem

The FileDropzone component displays "입력하지 않으면 50만원으로 계산해요" (if you don't enter it, it'll be calculated as 500,000 Won) when only one file is uploaded. However, the actual code does NOT use 500,000 as a default for `previousMonthSpending`.

The actual behavior when the user doesn't enter a value:
1. `analyzeMultipleFiles` (analyzer.ts:313-315) sets `previousMonthSpending` to `options?.previousMonthSpending` which is `undefined` when the user hasn't entered anything and only one month of data is present.
2. `optimizeFromTransactions` (analyzer.ts:184-203) receives `undefined`, triggering the else branch which computes per-card exclusion-filtered spending from the current month's transactions.

The per-card computation is more accurate than a flat 500,000 Won default, but the UI text is factually wrong. The user is told "50만원" but the system uses the actual spending amount.

## Tasks

### Task 1: Update FileDropzone helper text to match actual behavior

- **File:** `apps/web/src/components/upload/FileDropzone.svelte:409`
- **Change:** Replace `"입력하지 않으면 50만원으로 계산해요"` with `"입력하지 않으면 이번 달 지출액을 기준으로 자동 계산해요"`
- **Rationale:** The new text accurately describes the per-card exclusion-filtered spending computation that actually occurs. It avoids committing to a specific number (which varies per card and per upload) while still informing the user that the system will compute the value automatically.
- **Verify:** Visual inspection of the upload page

## Exit Criteria

- FileDropzone helper text accurately describes the actual `previousMonthSpending` default behavior
- No mention of "50만원" as a default value
- Text is clear that the system auto-computes based on spending

## Progress

### Task 1: DONE

- **Status:** COMPLETED
- **Date:** 2026-04-19
- **Changes:** Changed "입력하지 않으면 50만원으로 계산해요" to "입력하지 않으면 이번 달 지출액을 기준으로 자동 계산해요" at `apps/web/src/components/upload/FileDropzone.svelte:409`
- **Verification:** All 266 tests pass
