# Plan: Cycle 11 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle11-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [LOW] Add Math.abs() to analyzeMultipleFiles monthly spending calculation for consistency (C11-01)

**File:** `apps/web/src/lib/analyzer.ts:304`
**Problem:** `analyzeMultipleFiles` uses `tx.amount` directly in the monthly spending accumulation, while `reoptimize` (in `store.svelte.ts:378`) uses `Math.abs(tx.amount)`. This inconsistency could cause the monthly breakdown numbers to diverge after editing if negative-amount transactions are present. In practice, refunds are filtered out by the `tx.amount > 0` check in the optimizer, so they shouldn't reach either accumulation path, but the inconsistency is a latent risk.
**Fix:** Change line 304 in `analyzer.ts` from:
```ts
monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
```
to:
```ts
monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount));
```
Also apply the same change to line 305 for `monthlyTxCount` (count negative-amount transactions in the monthly count, matching the `Math.abs` approach for spending).
**Status:** DONE (already fixed in prior cycle -- Math.abs() was already present at line 304)

### 2. [LOW] Report errors for unparseable amounts in PDF fallback path (C11-03)

**File:** `apps/web/src/lib/parser/pdf.ts:352-394`
**Problem:** The PDF fallback parsing path does not report errors for unparseable amounts. When `parseAmount` returns 0 from a non-zero input in the fallback loop, the transaction is silently skipped without any error reported. The structured parse path (tryStructuredParse) was fixed in C10-03 to report these errors, but the fallback path was not updated.
**Fix:** In the fallback parsing loop, add error tracking when `parseAmount` returns 0 from a non-zero input:
```ts
// Before the fallbackTransactions return block (around line 387), add:
const amount = parseAmount(amountMatch[1]!);
if (amount !== 0) {
  fallbackTransactions.push({ ... });
} else {
  // Amount was unparseable -- report error matching structured path behavior
  const cleaned = amountMatch[1]!.replace(/원$/, '').replace(/,/g, '').trim();
  if (cleaned && !/^0+$/.test(cleaned)) {
    errors.push({ message: `금액을 해석할 수 없습니다: ${amountMatch[1]!.trim()}` });
  }
}
```
**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C11-02 | LOW/LOW severity; BASE_URL trailing slash is guaranteed by Astro; the pattern works correctly in all current configurations; only breaks if Astro's contract changes | Astro BASE_URL config changes without trailing slash |
| C10-03 (structured path) | DONE -- already fixed in prior cycle | N/A |
| C8-01 | MEDIUM severity but removing dead code requires UX decision about AI categorization; deferring per D-10/D-68 | Self-hosted AI runtime implementation decision |
| C4-10 | MEDIUM severity; E2E test infrastructure change; out of scope | E2E test framework refactor |
| C4-11 | MEDIUM severity; requires new test infrastructure; out of scope | Test coverage sprint |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable since any parsing error should result in null return | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
