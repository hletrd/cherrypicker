# Code Review — cherrypicker (Cycle 24)

**Reviewer:** code-reviewer (sonnet)
**Scope:** Code quality, logic correctness, maintainability
**Date:** 2026-05-06

---

## Summary

Cycle 23 fixed the event handler regex regression (C23-SEC01) and the sessionStorage truncation count (C22-DEBUG01). Cycle 24 review finds 2 new code-quality issues and verifies 1 prior fix.

---

## New Findings

### [C24-CR01-LOW] HTML event handler regex misses spaces around equals sign

**Files:** `apps/web/src/lib/parser/html.ts:42`
**Confidence:** High

The quoted-value event handler regex:
```ts
.replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, '')
```

Requires the `=` to be immediately followed by a quote. HTML attributes can legally have whitespace around the equals sign: `onclick = "alert(1)"`. Such markup would not be stripped by the regex, leaving the event handler intact.

**Fix:** Allow optional whitespace: `/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi`.

---

### [C24-CR02-LOW] Redundant isSummaryRow calls in HTML forward-fill

**Files:** `apps/web/src/lib/parser/html.ts:182, 191, 200, 209, 218, 227`
**Confidence:** High

For every non-empty cell in every data row, `isSummaryRow(String(rawValue))` is called twice: once in the update-guard block and once when computing the final `String(...)` expression. Since `isSummaryRow` compiles a fresh regex internally (verify module-level), this adds unnecessary overhead.

**Fix:** Cache `isSummaryRow` result per cell, or hoist the check so it only runs once per cell.

---

## Verified Fixed

| Finding | Status | Evidence |
|---------|--------|----------|
| C23-SEC01: Event handler regex regression | FIXED | Two-pattern approach (quoted + unquoted) correctly strips `onclick="..."` and `onclick=...` |
| C22-DEBUG01: Truncation preserves original count | FIXED | `transactionCount` and `totalTransactionCount` both set to 0 in truncated payload |
| C21-01: XLSX parseAmount duplication | FIXED | Web XLSX uses imported `parseAmountString` |

---

## Carry-overs

- A-ARCH-01: Server/web parser duplication (CRITICAL) — unchanged
- C20-PERF01: Greedy optimizer marginal reward caching (MEDIUM) — deferred
