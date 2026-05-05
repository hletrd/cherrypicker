# Debugger Review — cherrypicker (Cycle 19)

**Reviewer:** debugger
**Scope:** Latent bugs, failure modes, edge cases, regressions, invariant violations
**Date:** 2026-05-06

---

## Summary

Cycle 18 fixed type safety gaps in persistence code. Cycle 19 review identifies a spending calculation divergence between initial analysis and reoptimize that could produce silently wrong monthly breakdowns.

---

## New Findings

### C19-DB01 [MEDIUM] — Reoptimize monthly spending includes refunds; initial analysis excludes them

**File:** `apps/web/src/lib/analyzer.ts:327-332` vs `apps/web/src/lib/store.svelte.ts:498-519`
**Confidence:** High

The initial `analyzeMultipleFiles` excludes negative amounts from monthly spending (gross spending):
```ts
if (tx.amount > 0) {
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
}
```

But `reoptimize` includes all non-zero amounts (net spending):
```ts
if (tx.amount !== 0) {
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
}
```

**Failure scenario:** User uploads a statement with 500,000 KRW in purchases and 50,000 KRW refund.
- Initial analysis: monthlySpending = 500,000
- User edits one transaction, reoptimize: monthlySpending = 450,000
- The monthly breakdown chart shows different values before and after editing
- If the user had 2 months of data, `previousMonthSpending` could differ, affecting tier selection

**Fix:** Standardize on gross spending (`tx.amount > 0`) in both paths.

---

### C19-DB02 [LOW] — `parseOFXAmount` lacks full-width digit normalization

**File:** `apps/web/src/lib/parser/ofx.ts:76-82` / `packages/parser/src/ofx/index.ts:108-114`
**Confidence:** Medium

The web-side `parseOFXAmount` only strips commas and calls `parseFloat`:
```ts
const cleaned = raw.trim().replace(/,/g, '');
const n = parseFloat(cleaned);
```

The server-side version also lacks full-width digit normalization, unlike `parseAmountString` in `csv/shared.ts` which handles `０-９`, `，`, `．`, etc. If a Korean bank exports OFX with full-width digits (rare but possible in localized software), parsing would fail silently.

**Fix:** Reuse `parseAmountString` for OFX amount parsing, or add full-width normalization to `parseOFXAmount`.

---

### C19-DB03 [LOW] — `parsePreviousSpending` accepts `-0` as valid

**File:** `apps/web/src/components/upload/FileDropzone.svelte:292-313`
**Confidence:** Medium

The function coerces `-0` to `0` for numeric inputs, but for string inputs like `"-0"`:
```ts
const n = Math.round(Number(v)); // Number("-0") === -0
```
The `n >= 0` check passes (`-0 >= 0` is `true`), and `n === 0 ? 0 : n` also produces `0`. This is actually handled correctly. The comment mentions D7-M4 / C8-02 but the code is safe.

However, `Number("-0.1")` rounds to `0`, and the `n >= 0` check passes. A user entering `-0.1` gets `0` accepted without error. Not a bug, just permissive.

---

## Carry-overs from Previous Cycles

- **C18-DB01** — Rate recalculation assumes pre-filter invariant (LOW, still present)

---

## Verdict

**FIX AND SHIP** — C19-DB01 is a real correctness issue that produces divergent UI state.
