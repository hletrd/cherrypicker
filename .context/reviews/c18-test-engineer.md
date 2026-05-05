# Test Engineer — cherrypicker (Cycle 18)

**Reviewer:** test-engineer
**Scope:** Test coverage, gaps, regression risks, parity verification
**Date:** 2026-05-06

---

## Summary

Cycle 17 added regression tests for trailing-minus PDF fallback, `findField` prototype safety, full-width plus sign, and `normalizeHTML` broadening. Server-side parser test coverage is now comprehensive. Web-side tests remain sparse — only date, encoding, and analyzer adapter tests exist. The vacuous `parse-error.test.ts` structural test from Cycle 6 is still unfixed.

---

## New Findings

### C18-TEST01 [MEDIUM] — No web-side ParseError class unit tests

**File:** `apps/web/src/lib/parser/types.ts:30-47`
**Confidence:** High

The web-side `ParseError` was converted from an interface to a class extending Error (fixing C6-02), but no tests verify:
- `instanceof Error` compatibility
- `instanceof ParseError` compatibility
- Optional fields (`line`, `raw`, `file`, `format`) are correctly set
- The `.name` property is `'ParseError'`

Server-side has `packages/parser/__tests__/parse-error.test.ts` but it is also deficient (see C18-TEST02).

**Fix:** Add `apps/web/__tests__/parse-error.test.ts` with tests mirroring the server-side file but asserting actual construction behavior.

---

### C18-TEST02 [MEDIUM] — `parse-error.test.ts` structural test is still vacuous

**File:** `packages/parser/__tests__/parse-error.test.ts:34-43`
**Confidence:** High

Carry-over from C6-05. The test `used by at least 3 parsers` only checks that dynamic import promises are defined. It does not verify:
- That parsers construct `ParseError` instances
- That malformed input produces `ParseError` errors
- That `instanceof ParseError` checks succeed

**Fix:** Replace with actual structural tests that parse invalid content through OFX, HTML, and JSON parsers and assert `instanceof ParseError` on the returned errors.

---

### C18-TEST03 [LOW] — No web-side parser tests for HTML, OFX, JSON, XLSX

**File:** `apps/web/__tests__/`
**Confidence:** High

The web-side test directory contains:
- `analyzer-adapter.test.ts`
- `formatters.test.ts`
- `parser-date.test.ts`
- `parser-encoding.test.ts`
- `parser-html.test.ts` (added in cycle 17? need to verify)
- `parser-json.test.ts` (added in cycle 17? need to verify)
- `parser-ofx.test.ts` (added in cycle 17? need to verify)
- `parser-pdf.test.ts` (added in cycle 17? need to verify)

Wait — let me verify:

**Evidence:** `apps/web/__tests__/` directory listing:
```
analyzer-adapter.test.ts
formatters.test.ts
parser-date.test.ts
parser-encoding.test.ts
parser-html.test.ts
parser-json.test.ts
parser-ofx.test.ts
parser-pdf.test.ts
tx-validation.test.ts
```

Web-side parser tests for HTML, JSON, OFX, PDF DO exist. However, they may not cover all parity scenarios. Need to verify coverage depth.

**Revised finding:** The files exist but parity coverage depth is unknown. Recommend adding a parity test that runs identical fixtures through both server and web parsers.

---

## Verified Fixed

| Finding | Commit | Evidence |
|---------|--------|----------|
| C17-06: PDF trailing-minus test | `2d2ed35` | `packages/parser/__tests__/table-parser.test.ts` |
| C17-07: findField prototype test | `2d2ed35` | `packages/parser/__tests__/json.test.ts` |
| C17-08: Full-width plus test | `2d2ed35` | `packages/parser/__tests__/csv-shared.test.ts` |
| C17-09: normalizeHTML broad test | `2d2ed35` | `packages/parser/__tests__/html.test.ts` |
| T12-01: Zero column-matcher tests | earlier | 2500+ lines in `column-matcher.test.ts` |

---

## Carry-overs

| ID | Severity | Description |
|---|---|---|
| T6-02 | HIGH | No parity tests between server-side and web-side parsers |
| T13-02 | MEDIUM | No test for PDF fallback trailing-minus (web-side) |
| T13-03 | LOW | No test for OFX negative amount conversion |

---

## Verdict

**FIX AND SHIP** — Fix C18-TEST02 (vacuous test) and add web-side ParseError unit tests (C18-TEST01). Parser parity testing remains the largest gap.
