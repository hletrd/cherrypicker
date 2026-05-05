# Tracer — cherrypicker (Cycle 20)

**Reviewer:** tracer (sonnet)
**Scope:** Causal tracing of suspicious flows, competing hypotheses
**Date:** 2026-05-05

---

## Summary

Traced the OFX amount parsing path and confirmed a server/web divergence. Traced the HTML forward-fill path and identified a summary-row propagation edge case. Traced the analyzer cache invalidation and confirmed correct behavior for the web app's usage pattern.

---

## Traced Flows

### Flow 1: OFX amount parsing divergence

**Path:** `parseOFX` → `extractTag(block, 'TRNAMT')` → `parseOFXAmount(raw)`

**Server-side:**
```
parseOFXAmount("-15000.00") -> parseFloat("-15000.00") -> -15000
parseOFXAmount("１，２３４") -> parseFloat("１，２３４") -> NaN -> null
```

**Web-side:**
```
parseOFXAmount("-15000.00") -> parseAmountString("-15000.00") -> -15000
parseOFXAmount("１，２３４") -> parseAmountString("１，２３４") -> 1234
```

**Hypothesis:** The web-side's use of `parseAmountString` was intentional (to handle full-width). But it was never backported to server-side.
**Evidence:** Commit C100-03 added the web-side `parseAmountString` delegation with comment "Reuses parseAmountString for full-width digit and format normalization."
**Conclusion:** Intentional improvement on web-side that was not propagated. Parity gap.

---

### Flow 2: HTML forward-fill summary propagation

**Path:** `parseHTMLSheet` → forward-fill loop → `lastAmount` update

**Scenario:** Header row → Summary row ("총합계", amount=999999) → Merged data rows

**Trace:**
1. Summary row passes `isSummaryRow(rowText)` → skipped at line 146
2. But summary row has `row.every((c) => !c)` = false (has cells)
3. The loop reaches amount forward-fill section
4. `rawAmountValue` = summary amount cell = "999999"
5. `isSummaryRow(String(rawAmountValue))` = `isSummaryRow("999999")` → false (no summary keywords)
6. `lastAmount` = "999999"
7. Next merged data row: `amountRaw` falls back to `lastAmount` = "999999"

**Hypothesis:** Summary rows with numeric-only amounts would poison forward-fill.
**Evidence:** `isSummaryRow` only matches text patterns, not bare numbers.
**Conclusion:** Confirmed edge case. Numeric summary amounts propagate through forward-fill.

---

### Flow 3: Analyzer cache invalidation

**Path:** `analyzeMultipleFiles` → `optimizeFromTransactions` → `cachedCoreRules`

**Trace:**
1. First call: `cachedCoreRules` is null → transforms rules → caches
2. Second call with `cardIds`: retrieves cached (ALL rules) → filters
3. No invalidation of filtered result

**Hypothesis:** Alternating filtered/unfiltered calls would cause cache misses or stale data.
**Evidence:** Web app always calls `analyze()` first (unfiltered), then `reoptimize()` with same cardIds. No alternation.
**Conclusion:** Not a bug in practice, but a latent issue if the calling pattern changes.

---

## Verdict

**FIX AND SHIP** — Flow 1 and Flow 2 confirm real bugs. Flow 3 is defensive.
