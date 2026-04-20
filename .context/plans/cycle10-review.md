# Plan: Cycle 10 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle10-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [MEDIUM] Add try/catch around sessionStorage.getItem in SpendingSummary onMount (C10-01)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:9-12`
**Problem:** The `onMount` callback reads `sessionStorage.getItem('cherrypicker:dismissed-warning')` with only a `typeof sessionStorage !== 'undefined'` guard. This prevents `ReferenceError` in SSR but does NOT prevent `SecurityError` in restricted environments (strict private browsing, cross-origin iframes, some mobile browsers). If `SecurityError` is thrown, the component crashes on mount and prevents the entire dashboard from rendering. Notably, line 133 already has `try { sessionStorage.setItem(...) } catch {}` for the write path, but the read path at line 10 is unguarded.
**Fix:** Wrap the sessionStorage read in try/catch:
```ts
onMount(() => {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cherrypicker:dismissed-warning')) {
      dismissed = true;
    }
  } catch {}
});
```
**Status:** DONE

### 2. [LOW] Report errors for unparseable amounts in PDF parser (C10-03)

**File:** `apps/web/src/lib/parser/pdf.ts:207-213` and `tryStructuredParse` function
**Problem:** PDF `parseAmount` returns 0 for NaN amounts (line 212: `Number.isNaN(n) ? 0 : n`), which are then silently filtered by `if (amount === 0) continue` at line 264 without reporting an error. In contrast, CSV's `parseAmount` returns NaN and the caller uses `isValidAmount()` to push a descriptive error. This inconsistency means the PDF parser silently drops transactions with unparseable amounts while the CSV parser reports them.
**Fix:** In `tryStructuredParse`, track when `parseAmount` returns 0 from a non-empty input and push an error. Add an `errors` array parameter to the function signature, or track errors in a side-channel:
```ts
// In tryStructuredParse, after line 261:
const amountRaw = amountCell.value;
const amount = parseAmount(amountRaw);

// Skip zero-amount rows
if (amount === 0) {
  // If the raw value was non-empty, report an error (matching CSV parser behavior)
  if (amountRaw.trim() && amountRaw.replace(/원$/, '').replace(/,/g, '').trim()) {
    errors.push({ message: `금액을 해석할 수 없습니다: ${amountRaw.trim()}` });
  }
  continue;
}
```
**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C10-02 | LOW/Informational; AbortController correctly masks errors on navigation -- this is desired behavior; no fix needed | N/A (no fix needed) |
| C53-02 | LOW severity; duplicated stats reading already has existing plan in c53-medium-priority-fixes.md Task 3 | Refactor when Layout or index.astro changes |
| C53-03 | LOW severity; CardDetail dark mode contrast already has existing plan | Design review |
| C4-10 | MEDIUM severity; E2E test infrastructure change; out of scope | E2E test framework refactor |
| C4-11 | MEDIUM severity; requires new test infrastructure; out of scope | Test coverage sprint |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable since any parsing error should result in null return | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
