# Cycle 11 — Tracer Findings

**Date:** 2026-05-05
**Reviewer:** tracer (simulated)
**Scope:** Causal tracing of suspicious flows, competing hypotheses

## Summary

The Infinity bug causal chain from cycle 10 is fully resolved. No new suspicious flows identified.

---

## Causal Analysis

### C11-TR01 — Infinity bug: RESOLVED

**Root cause (cycle 10):** `parseFloat('Infinity')` returns `Infinity`, which was then passed to `Math.round()` producing `Infinity`, which propagated through optimization calculations causing `formatWon` to return `'Infinity원'`.

**Fix verification:**
1. `parseAmountString` now checks `Number.isFinite(n)` at line 161
2. All callers (CSV, XLSX, PDF, JSON, OFX, HTML) delegate to `parseAmountString`
3. Web-side parsers have identical guards
4. Tests verify `Infinity` → `null` for all formats

**Causal chain:** BROKEN at source. No propagation path exists.

---

### C11-TR02 — console.warn in production: PARTIALLY RESOLVED

**Causal chain:**
1. Adapter failure → `console.warn` emitted
2. Production build includes `console.warn` calls
3. Browser console shows warnings to end users

**Break point:** Server-side fixed (cycle 10). Web-side still active.

**Path:** `apps/web/src/lib/parser/csv.ts:876` → `console.warn`
**Path:** `apps/web/src/lib/parser/pdf.ts:478` → `console.warn`

---

### C11-TR03 — monthlyBreakdown stale data: RESOLVED

**Causal chain:**
1. User edits transaction amount in non-latest month
2. `reoptimize` filters to latest month for optimization
3. Old code: `monthlyBreakdown` carried over from original analysis
4. Result: edited month shows stale spending total

**Fix:** Lines 531-551 compute `updatedMonthlyBreakdown` from `editedTransactions`, line 598 stores it in result.

**Causal chain:** BROKEN. Edits now propagate to monthlyBreakdown.

---

## Competing Hypotheses Checked

- **H1:** Infinity guard might miss edge case with `Number.POSITIVE_INFINITY` as a string. → TESTED: `parseAmountString('Infinity')` returns `null` because `parseFloat('Infinity')` → `Infinity` → `!Number.isFinite(n)` → `null`. Correct.
- **H2:** Web-side CSV amount parsing might not have Infinity guard. → VERIFIED: `apps/web/src/lib/parser/csv.ts:149` has `!Number.isFinite(parsed)`. Correct.
- **H3:** JSON parser might parse `Infinity` as a number before normalization. → VERIFIED: `packages/parser/src/json/index.ts:81` checks `Number.isFinite(raw)`. Correct.

## Verdict

All critical causal chains are broken. One minor chain (web-side console.warn) remains open.
