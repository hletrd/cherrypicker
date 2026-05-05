# Cycle 10 Tracer Review — Causal Flow Analysis

**Reviewer:** tracer  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Traced Flows

### Flow 1: Malformed amount -> Infinity -> parse result -> optimizer
**Chain:** Uploaded file -> parseAmountString/parseOFXAmount -> Infinity amount -> RawTransaction.amount = Infinity -> categorizer -> optimizer filter -> excluded from optimization.
**Finding:** The optimizer's `Number.isFinite` guard (greedy.ts:204) prevents Infinity from affecting calculations, but Infinity amounts are still present in `ParseResult.transactions` and `ParseResult.errors`. The report generator's `formatWon` handles Infinity by returning "0원".
**Bottleneck:** No single point catches Infinity. It's a distributed responsibility that happens to work but relies on every downstream consumer guarding.
**Fix:** Fix at source (parsers) rather than relying on downstream guards.
**Confidence:** High

### Flow 2: User uploads HTML -> web parser -> forward-fill -> transaction
**Chain:** FileDropzone -> analysisStore.analyze -> parseHTML -> SheetJS -> parseHTMLSheet -> forward-fill -> transactions.
**Finding:** Forward-fill correctly handles merged cells. No causal chain issues found.
**Confidence:** High

### Flow 3: User uploads OFX (credit card) -> CCSTMTRS detection -> transactions
**Chain:** parseOFX -> extractTransactionBlocks -> SGML/XML pattern -> CCSTMTRS terminators -> extractTag -> transactions.
**Finding:** Credit card OFX support (C99-03) is implemented consistently on both server and web. Causal chain verified.
**Confidence:** High

### Flow 4: Parser fix applied to server but not web (parity drift)
**Chain:** Bug found -> fix server-side -> forget web-side -> web users affected.
**Finding:** This has happened in past cycles (C9-01, C9-02, C9-03 were all parity fixes). The structural duplication between packages/parser and apps/web/src/lib/parser makes this inevitable.
**Root cause:** Architectural debt (D-01) — no shared parser module.
**Fix:** Prioritize D-01 refactor.
**Confidence:** High

---

## Summary

| Flow | Status | Root Cause |
|------|--------|------------|
| Infinity propagation | Vulnerable | Missing finite check in parsers |
| HTML forward-fill | Safe | Correct implementation |
| OFX credit card | Safe | Correct implementation |
| Parity drift | Recurring | Architectural duplication |

**Verdict:** FIX AND SHIP
