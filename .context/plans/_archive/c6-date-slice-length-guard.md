# Plan: Cycle 6 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle6-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [LOW] Add date length guard in `analyzer.ts` monthly spending calculation (C6-03)

**File:** `apps/web/src/lib/analyzer.ts:300`
**Problem:** The monthly spending calculation does `tx.date.slice(0, 7)` to extract the YYYY-MM prefix. If a transaction has a malformed date string shorter than 7 characters (e.g., just "2026" from corrupted sessionStorage), `slice(0, 7)` returns the whole string, producing an incorrect month key. The same pattern exists at line 376 in `reoptimize`.
**Fix:** Add a length check before slicing:
```ts
// Before:
const month = tx.date.slice(0, 7); // "2026-01"

// After:
const month = tx.date.length >= 7 ? tx.date.slice(0, 7) : null;
if (!month) continue;
```
Apply the same guard to both occurrences (line 300 and line 376).
**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C4-06/C52-03/C9-02 | LOW severity; annual projection label partially addressed; UX team input needed | UX review recommends different label |
| C4-09/C52-05 | LOW severity; dark mode contrast acceptable for most colors; design token migration is larger effort | Design system integration planned |
| C4-10 | MEDIUM severity; E2E test infrastructure change; out of scope | E2E test framework refactor |
| C4-11 | MEDIUM severity; requires new test infrastructure; out of scope | Test coverage sprint |
| C4-13/C9-08 | LOW severity; visual polish; small bars still visible at wider widths | Design review |
| C9-04 | LOW severity; complex regex works correctly for all known PDF formats | PDF parser rewrite |
| C9-06 | LOW severity; rounding affects only edge cases with many tiny categories | Threshold adjustment PR |
| C9-07 | LOW severity; theoretical; no real datasets approach the limit | Large dataset reported |
| C9-09 | LOW severity; categories cache is static JSON; invalidation not needed | Dynamic category loading implemented |
| C9-10 | LOW severity; double-decode is harmless; re-encode is defensive | XLSX parser refactor |
| C9-12 | LOW severity; module-level cache is intentional for static JSON data | Store architecture change |
| D-66 | LOW severity; issuer filter UX is functional; existing $effect resets stale filters | UX redesign |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable for resilience | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
