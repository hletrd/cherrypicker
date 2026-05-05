# Test Engineer — cherrypicker (Cycle 6)

**Reviewer:** test-engineer
**Scope:** Test coverage, gaps, regression risks for changes since Cycle 5
**Date:** 2026-05-06

---

## Summary

Cycle 6 added tests for ParseError (structural), LRU cache (correctness + eviction), path validation (traversal + existence), and LLM consent (flag enforcement). These are well-written and cover the happy path. However, gaps remain in error-path coverage, edge cases, and cross-package parity verification.

---

## Verified Fixed

| Finding | Commit | Evidence |
|---------|--------|----------|
| T-TE-01: No web component tests | — | Out of scope for cycle 6; still open |
| T-TE-02: No parity tests | — | Still open; see T6-02 below |
| T-TE-03: No CLI integration tests | ce91407, 41fb34c | New tests in `commands.test.ts` cover validation and consent |

---

## New Findings (Cycle 6)

### [T6-01-MEDIUM] ParseError test is vacuous — does not verify actual parser usage

**File:** `packages/parser/__tests__/parse-error.test.ts:34-43`
**Confidence:** High

The test "used by at least 3 parsers" only verifies that dynamic imports resolve. It does NOT verify that OFX, HTML, or JSON parsers actually construct `new ParseError(...)` instances. A parser could import `ParseError` but construct plain `{ message: ... }` objects, and this test would still pass.

**Fix:** Replace with behavioral tests: parse malformed input through each of the 3 parsers and assert `err instanceof ParseError` on returned errors.

```ts
test('OFX parser returns ParseError instances for malformed content', async () => {
  const result = parseOFX('not xml', null);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors[0]).toBeInstanceOf(ParseError);
});
```

---

### [T6-02-HIGH] No parity tests between server-side and web-side parsers

**Files:** `packages/parser/src/` vs `apps/web/src/lib/parser/`
**Confidence:** High

With 7 parser formats (CSV, XLSX, PDF, JSON, OFX, HTML) now implemented on both sides, there are 14 parser implementations. Any divergence in behavior (e.g., web-side JSON parser takes `Math.abs()` of amounts while server-side doesn't, or web-side HTML parser lacks forward-fill) produces inconsistent user experiences.

**Fix:** Add a parity test suite that runs the same fixture files through both server-side and web-side parsers and compares `ParseResult` outputs. Use shared test fixtures in `packages/parser/__tests__/fixtures/`.

---

### [T6-03-MEDIUM] No tests for JSON parser negative amount handling

**File:** `packages/parser/src/json/index.ts:116`
**Confidence:** High

The JSON parser takes `Math.abs(amount)` for all amounts, including negative values that represent refunds. There are no tests covering this behavior. A test with `{ "amount": -50000 }` would reveal the silent conversion.

**Fix:** Add tests for negative amounts, zero amounts, and large values in `json.test.ts`.

---

### [T6-04-MEDIUM] LRU cache tests don't cover concurrent access

**File:** `packages/core/__tests__/categorizer.test.ts`
**Confidence:** Medium

The LRU cache tests verify sequential correctness and eviction, but not concurrent access. In a web app context where multiple `MerchantMatcher` instances might be created, or where async operations overlap, race conditions on the shared `Map` could corrupt cache state.

**Fix:** Add a test that creates multiple matchers, calls `match()` concurrently, and verifies results are still correct.

---

## Still Open from Cycle 5

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| T-TE-01 | No web component tests for FileDropzone | HIGH | **OPEN** |
| T-TE-04 | No optimizer benchmark or perf regression tests | MEDIUM | **OPEN** |
| T-TE-05 | LLM fallback untestable without API key | MEDIUM | **OPEN** |
| V-VER-01 | FileDropzone error path coverage unverified | MEDIUM | **OPEN** |
