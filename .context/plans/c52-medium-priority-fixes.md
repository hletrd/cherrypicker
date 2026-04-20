# Plan: Cycle 52 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle52-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [MEDIUM] Fix web-side CSV bank-specific adapter error collection (C52-01 / D-107)

**File:** `apps/web/src/lib/parser/csv.ts:962-969`
**Problem:** When a bank-specific adapter throws during `parseCSV`, the web-side catch block only logs via `console.warn` and does NOT collect the error into the result's `errors` array. The server-side `packages/parser/src/csv/index.ts:46-49` correctly adds the failure message to `fallbackResult.errors`.
**Fix:** Add error collection into the result before returning the fallback, matching the server-side pattern:
```ts
} catch (err) {
  const fallbackResult = parseGenericCSV(content, resolvedBank);
  fallbackResult.errors.unshift({
    message: `${adapter.bankId} 어댑터 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
  });
  return fallbackResult;
}
```
**Status:** DONE — commit `0000000ca7770aba67a0ab93fb60f5749da59c8c`

### 2. [MEDIUM] Fix TransactionReview AI categorization in-place mutation (C52-02)

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:108-125`
**Problem:** The `runAICategorization` function mutates `editedTxs` array entries in-place via `tx.category = result.category`. This is fragile with Svelte 5 reactivity and may not trigger re-renders in edge cases.
**Fix:** Replace entries instead of mutating in-place. Change the loop to use `findIndex` + array replacement:
```ts
const idx = editedTxs.findIndex(t => t.id === txId);
if (idx !== -1) {
  const tx = editedTxs[idx];
  const updated = tx.category !== result.category
    ? { ...tx, category: result.category, subcategory: undefined, confidence: result.confidence }
    : { ...tx, category: result.category, confidence: result.confidence };
  editedTxs = editedTxs.map((t, i) => i === idx ? updated : t);
}
```
**Status:** DONE — commit `00000006b741441fddc511184efe21cd7c7ca21f`

### 3. [MEDIUM] Fix SpendingSummary localStorage/sessionStorage inconsistency (C52-06 / C4-07)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:10,128`
**Problem:** The dismissal flag for the "탭을 닫으면 결과가 사라져요" warning is stored in `localStorage` while all analysis data uses `sessionStorage`. After a browser restart, the warning stays dismissed but data is gone.
**Fix:** Change `localStorage.getItem('cherrypicker:dismissed-warning')` to `sessionStorage.getItem('cherrypicker:dismissed-warning')` and `localStorage.setItem` to `sessionStorage.setItem`. This way the warning re-appears in new sessions where the data is actually gone.
**Status:** DONE — commit `000000047c02d4b585d1d98f217a6d460bda074a`

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C52-03/C4-06/C9-02 | LOW severity; annual projection label partially addressed with "최근 월 기준" caveat; UX team input needed | UX review recommends different label |
| C52-04/C4-14 | LOW severity; fallback values are correct at time of writing; only affects build-time failures | cards.json becomes unavailable at build time |
| C52-05/C4-09 | LOW severity; dark mode contrast is acceptable for most colors; only 2-3 very dark entries affected; design token migration is a larger effort | Design system integration planned |
| C4-10 | MEDIUM severity but E2E test infrastructure change; out of scope for this cycle | E2E test framework refactor |
| C4-11 | MEDIUM severity but requires new test infrastructure; out of scope | Test coverage sprint |
| C4-13 | LOW severity; visual polish; small bars still visible at wider widths | Design review |
| C9-04 | LOW severity; complex regex works correctly for all known PDF formats | PDF parser rewrite |
| C9-06 | LOW severity; rounding affects only edge cases with many tiny categories | Threshold adjustment PR |
| C9-07 | LOW severity; theoretical; no real datasets approach the limit | Large dataset reported |
| C9-08 | LOW severity; comparison bars are correct when both rewards are 0 | UX review |
| C9-09 | LOW severity; categories cache is static JSON; invalidation not needed for current use case | Dynamic category loading implemented |
| C9-10 | LOW severity; double-decode is harmless; re-encode is defensive | XLSX parser refactor |
| C9-12 | LOW severity; module-level cache is intentional for static JSON data | Store architecture change |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable since any parsing error should result in null return (falling through to LLM fallback) | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
