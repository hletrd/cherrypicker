# Cycle 17 — Tracer Review

**Date:** 2026-05-05
**Scope:** Causal tracing of suspicious flows, competing hypotheses

## Trace T1: PDF fallback amount parsing divergence

**Hypothesis A:** The server-side PDF fallback scanner has a copy-paste error where the trailing-minus capture group was incorrectly structured during a previous parity sync.
**Evidence:** The web-side regex at line 573 has `([\d,]*(?:,|\d{5,})[\d,]*-)` (minus inside). The server-side at line 318 has `([\d,]*(?:,|\d{5,})[\d,]*)-` (minus outside). The surrounding regex alternatives and comments are identical, suggesting a manual copy that introduced the error.
**Likelihood:** High.

**Hypothesis B:** The server-side regex was intentionally different because `parseAmountString` (server) handles trailing minus differently than `parseAmount` (web).
**Evidence:** Both `parseAmountString` and `parseAmount` have identical trailing-minus handling code (`/\d-$/.test(cleaned)`). The server passes the captured group (without minus) to the function, so the minus handling never triggers.
**Likelihood:** Low — the identical handling code suggests the intention was parity.

**Conclusion:** Hypothesis A is correct. A manual copy error during a previous parity sync introduced the divergence.

## Trace T2: `findField` prototype chain access

**Hypothesis A:** The `in` operator was chosen for brevity and the developer didn't consider prototype pollution.
**Evidence:** The function is simple and has no comments about prototype safety. The JSON parser was added in C97, suggesting it was written quickly.
**Likelihood:** High.

**Hypothesis B:** `in` was intentionally chosen to support inherited properties from prototype-based transaction objects.
**Evidence:** No evidence of such objects in the codebase. All JSON inputs are plain objects from `JSON.parse`.
**Likelihood:** Low.

**Conclusion:** Hypothesis A. A straightforward security fix to `Object.hasOwn` is appropriate.
