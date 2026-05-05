# Code Review — cherrypicker (Cycle 18)

**Reviewer:** code-reviewer
**Scope:** Code quality, logic correctness, maintainability, residual type safety
**Date:** 2026-05-06

---

## Summary

Cycle 17 fixed the PDF trailing-minus parity bug, `findField` prototype safety, `MIGRATIONS` any type, `normalizeHTML` tag coverage, and full-width plus sign handling. Cycle 18 review confirms these fixes landed correctly. Two new findings surface: lingering `any` types in persistence callbacks and an unfixed vacuous test from Cycle 6.

---

## New Findings

### C18-CR01 [MEDIUM] — `loadFromStorage` callback parameters still use `any`

**File:** `apps/web/src/lib/store.svelte.ts:247,286`
**Confidence:** High

The `MIGRATIONS` type was fixed from `any` to `unknown` (commit `4cdb832`), but two callback parameters in `loadFromStorage` still use `any`:

```ts
// Line 247
const validCardResults = parsed.optimization.cardResults.filter(
  (cr: any) => cr && typeof cr === 'object' && typeof cr.cardId === 'string'
);

// Line 286
? parsed.monthlyBreakdown.map((item: any) => ({ ... }))
```

These `any` types bypass TypeScript's structural checking for persisted data. If a malformed object survives the shallow validation above, the `any`-typed callbacks silently accept unexpected shapes. While the runtime checks (`typeof cr.cardId === 'string'`, etc.) provide some safety, the `any` annotation prevents the compiler from catching refactor drift.

**Fix:** Replace `cr: any` with `cr: unknown` and narrow with type guards. Replace `item: any` with a mapped type or inline interface.

---

### C18-CR02 [LOW] — `parse-error.test.ts` vacuous structural test remains unfixed

**File:** `packages/parser/__tests__/parse-error.test.ts:34-43`
**Confidence:** High

This finding (C6-05) was reported in Cycle 6 and remains open in Cycle 18. The test:

```ts
test('used by at least 3 parsers (OFX, HTML, JSON)', () => {
  const ofx = import('../src/ofx/index.js');
  const html = import('../src/html/index.js');
  const json = import('../src/json/index.js');
  expect(ofx).toBeDefined();
  expect(html).toBeDefined();
  expect(json).toBeDefined();
});
```

Only verifies that dynamic import promises exist. It does NOT verify that parsers construct `ParseError` instances or that `instanceof ParseError` works. A parser could import but never use `ParseError` and this test would pass.

**Fix:** Parse malformed content through each parser and assert `instanceof ParseError` on returned errors. Or grep source for `new ParseError` occurrences per parser.

---

## Verified Fixed

| Finding | Commit | Evidence |
|---------|--------|----------|
| C17-CR01: PDF trailing-minus | `302665c` | Server regex now matches web: minus inside capture group |
| C17-CR02: `findField` `in` operator | `5ee080c` | `Object.hasOwn(obj, alias)` in both server and web JSON parsers |
| C17-CR03: `MIGRATIONS` any | `4cdb832` | `Record<number, (data: unknown) => unknown>` |
| C17-CR04: `normalizeHTML` narrow | `20dce32` | Generic `([a-z][a-z0-9]*)` pattern in both copies |
| C17-CR05/06: Full-width plus | `ba7a2f3` | `.replace(/＋/g, '+')` in server shared.ts and web pdf.ts |
| C6-01: JSON Math.abs | earlier | `packages/parser/src/json/index.ts:115` preserves negatives |
| C6-02: Web ParseError interface | earlier | `apps/web/src/lib/parser/types.ts:30-47` is now a class |
| C6-04: Anthropic model name | earlier | `'claude-3-7-sonnet-latest'` in llm-fallback.ts |
| C6-06: Consent English prompt | earlier | Korean prompt in `tools/cli/src/consent.ts:35` |

---

## Still Open from Prior Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| C-CR-01 | Non-KRW transactions silently dropped | MEDIUM | **OPEN** |
| C-CR-04 | Web app redefines CardRuleSet inline | MEDIUM | **OPEN** |
| C6-03 | categoryLabels duplication | MEDIUM | **FIXED** (extracted to `@cherrypicker/rules`) |
| A-ARCH-01 | Server/web parser duplication | CRITICAL | **OPEN** |

---

## Verdict

**REQUEST CHANGES** — C18-CR01 should be fixed to close the remaining type-safety gap in persistence code. C18-CR02 is a test-quality issue that should be addressed to prevent false confidence.
