# Tracer — cherrypicker (Cycle 23)

**Reviewer:** tracer
**Scope:** Causal tracing of suspicious flows
**Date:** 2026-05-05

---

## Summary

Traced the root cause of C23-SEC01 to the C22-SEC01 fix in commit `804fa23`.

---

## Causal Chain

1. **Cycle 19/20:** Security reviewer identifies that HTML event handlers are not stripped (`C20-SEC02`)
2. **Cycle 22:** Commit `804fa23` adds event handler stripping to web-side `normalizeHTML`
3. **Cycle 22:** The fix uses a single regex `\son\w+=[^>\s]*` instead of the server-side's two-pattern approach
4. **Cycle 22:** Tests are added but only cover simple cases (no spaces in values)
5. **Cycle 23:** The regex fails on real-world JavaScript that contains spaces, leaving partial attribute values

**Root cause:** The C22-SEC01 fix was a minimal patch that didn't align with the server-side implementation. The test coverage was insufficient to catch the regression.

---

## Verdict

**FIX AND SHIP** — Align web-side normalizeHTML with server-side and add comprehensive tests.
