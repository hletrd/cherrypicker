# Test Engineer — cherrypicker (Cycle 23)

**Reviewer:** test-engineer
**Scope:** Test coverage, gaps, regression risks
**Date:** 2026-05-05

---

## Summary

Cycle 22 added HTML sanitization tests and full-width dot date tests. Cycle 23 review finds a critical test gap: the event handler sanitization tests don't cover attribute values containing spaces, which is exactly the case that fails in production.

---

## New Findings

### [C23-TEST01-HIGH] No test for event handler with spaces in quoted values

**Files:** `apps/web/__tests__/parser-html.test.ts:102-114`
**Confidence:** High

The existing tests cover:
- `onclick="alert(1)"` — passes
- `onclick=alert(1)` — passes
- `onclick=` — passes

But NONE cover:
- `onclick="alert(1); console.log(2)"` — **FAILS in production**
- `onerror="fetch('evil')"` — passes (no spaces)
- Multi-line attribute values — **FAILS in production**

**Fix:** Add test cases that include spaces and semicolons in event handler values.

---

### [C23-TEST02-MEDIUM] No test for normalizeHTML parity between server and web

**Files:** `apps/web/__tests__/parser-html.test.ts`, `packages/parser/__tests__/html.test.ts`
**Confidence:** High

The server-side and web-side HTML parsers each have their own `normalizeHTML` tests, but there's no shared test fixture ensuring both implementations produce identical output for the same input.

**Fix:** Create a shared test fixture (e.g., a list of HTML snippets and expected normalized outputs) that both test suites run.

---

## Carry-overs from Previous Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| C22-TEST02 | No test for sessionStorage truncation path | LOW | **OPEN** |
| T6-02 | No parity tests between server/web parsers | HIGH | **OPEN** — partially addressed for some formats |

---

## Verdict

**FIX AND SHIP** — C23-TEST01 is critical; it would have caught the C23-SEC01 regression.
