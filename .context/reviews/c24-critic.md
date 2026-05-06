# Critic — cherrypicker (Cycle 24)

**Reviewer:** critic
**Scope:** Multi-perspective critique of the whole change surface
**Date:** 2026-05-06

---

## Summary

Cycle 23 was a reactionary fix cycle — it patched regressions introduced by cycle 22's incomplete fix. The deeper pattern is that parser duplication (A-ARCH-01) continues to cause concrete bugs. Each cycle reacts to the previous cycle's fallout rather than addressing root causes.

---

## New Findings

### [C24-CRIT01-LOW] Reactive fix-cycles indicate systemic test gap

**Confidence:** High

Cycles 22-24 have all involved fixing or re-fixing the HTML `normalizeHTML` sanitization:
- C22: Added single-regex sanitization
- C23: Fixed regression where quoted values with spaces were partially stripped
- C24: Discovered the fix still misses whitespace around `=`

This progression reveals that the web-side parser code lacks parity with the server-side implementation AND lacks sufficient test coverage for edge cases in HTML sanitization.

**Fix:** Add comprehensive sanitization test matrix (quoted/unquoted/whitespace/empty/missing-value/event names) and consider importing the server-side implementation verbatim.

---

## Cross-Cycle Patterns

| Pattern | Cycles | Root Cause |
|---------|--------|------------|
| normalizeHTML fixes | 22, 23, 24 | Duplicated code diverged from server |
| parseAmount parity | 21, 22 | XLSX/CSV reimplemented shared logic |
| sessionStorage truncation | 22, 23 | Complex state machine without integration tests |

---

## Verdict

**FIX AND SHIP** — C24 findings are bounded and addressable. The dominant recommendation is to invest in eliminating parser duplication (A-ARCH-01) to stop the fix-cycle churn.
