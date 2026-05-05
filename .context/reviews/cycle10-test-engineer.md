# Cycle 10 Test Engineer Review — Coverage, Flakiness, Gaps

**Reviewer:** test-engineer  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P1-HIGH] No tests for Infinity amount inputs
**Description:** None of the parser test suites test edge cases like `"1e309"`, extremely long numeric strings, or values near Number.MAX_VALUE.
**Impact:** The Infinity bug (cycle10-code-reviewer P1) would not be caught by existing tests.
**Fix:** Add test cases to `packages/parser/__tests__/` and `apps/web/__tests__/` for:
- String amounts that parse to Infinity
- Very large numbers
- Empty/zero/negative amount combinations
**Confidence:** High

### [P2-MEDIUM] No e2e tests for HTML/OFX/JSON parser paths
**Description:** The e2e tests (`e2e/`) focus on UI regressions. There are no end-to-end tests that upload HTML, OFX, or JSON files through the full web flow.
**Impact:** Parser parity issues only surface in production.
**Fix:** Add e2e tests using Playwright that upload sample HTML, OFX, and JSON files and verify correct transaction counts.
**Confidence:** High

### [P2-MEDIUM] No tests for forward-fill HTML logic
**Description:** The HTML forward-fill logic (C99-02, C100-01) has no targeted tests for merged cell scenarios.
**Impact:** Forward-fill regressions won't be caught.
**Fix:** Add test fixtures with merged cells and verify forward-fill behavior.
**Confidence:** Medium

### [P3-LOW] Test output includes ANSI escape codes
**Description:** `@cherrypicker/cli:test` output shows `[90m┌──────────[39m` style ANSI codes in test logs.
**Impact:** Makes test logs harder to read in CI.
**Fix:** Strip ANSI codes or use a test reporter that handles them.
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P1-HIGH | 1 |
| P2-MEDIUM | 2 |
| P3-LOW | 1 |

**Verdict:** FIX AND SHIP
