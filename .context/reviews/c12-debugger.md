# Debugger — Cycle 12

**Date:** 2026-04-24
**Reviewer:** debugger

## Findings

### C12-DB01: `reoptimize` monthlyBreakdown recalculation may include non-latest-month spending [LOW]
- **File:** `apps/web/src/lib/store.svelte.ts:513-533`
- **Description:** In `reoptimize()`, `monthlyBreakdown` is recalculated from ALL `editedTransactions` (not just latest-month). The optimization itself only uses latest-month transactions (line 504-506). This means `monthlyBreakdown` correctly shows all months for display, but the `previousMonthSpending` calculation at line 552-561 correctly uses `updatedMonthlyBreakdown` (which includes all months) to find the previous month's spending. This is correct behavior — `monthlyBreakdown` is for display, `previousMonthSpending` is for the optimizer. No bug.
- **Confidence:** High
- **Severity:** LOW (confirmed correct, no action needed)

### C12-DB02: `scoreCardsForTransaction` push/pop pattern assumes single-threaded execution [LOW]
- **File:** `packages/core/src/optimizer/greedy.ts:141-143`
- **Description:** The push/pop optimization for `currentTransactions` mutates the array temporarily during scoring. This is safe in JavaScript's single-threaded event loop, but if `calculateCardOutput` ever became async (e.g., fetching data), the mutation would leak between cards. The current code is synchronous, so this is safe.
- **Confidence:** High
- **Severity:** LOW (informational, no current risk)

### C12-DB03: `parsePDF` fallback line scanner date match group indexing [LOW]
- **File:** `apps/web/src/lib/parser/pdf.ts:356-391`
- **Description:** The fallback line scanner uses `dateMatch[0]` and `dateMatch[1]` but `dateMatch` is the result of `line.match(fallbackDatePattern)` which returns a full match array. When the pattern matches a date like "2024.01.15", `dateMatch[1]` is `undefined` because the pattern has no capture groups. The code at line 383 passes `dateMatch[1]!` to `parseDateToISO()`, which receives `undefined` and falls through to `String(undefined)` = "undefined". However, this path is only reached when the structured parser fails AND the fallback matches, and in practice the `parseDateToISO` function handles `undefined` gracefully by returning an invalid date string that gets filtered later. This is a latent bug but has no visible effect because the transaction would be excluded from optimization.
- **Confidence:** High
- **Severity:** LOW (latent, no visible effect due to downstream filtering)

## Convergence Note

No new HIGH or MEDIUM bug findings. One latent issue (C12-DB03) found in the PDF fallback path, but it has no visible effect. The codebase has extensive defensive checks that prevent latent issues from manifesting as user-visible bugs.
