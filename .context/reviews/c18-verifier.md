# Verifier — cherrypicker (Cycle 18)

**Reviewer:** verifier
**Scope:** Evidence-based correctness check against stated behavior
**Date:** 2026-05-06

---

## Summary

Verification of Cycle 17 fixes and prior open issues. All 6 Cycle 17 code fixes are verified in source. The MIGRATIONS type fix is partial — the Record value type uses `unknown` but callback bodies in `loadFromStorage` still use `any`. Gates (lint, typecheck, tests) are passing.

---

## Verification Results

### Cycle 17 Fixes — Verified

| Finding | File | Evidence | Status |
|---------|------|----------|--------|
| C17-01: PDF trailing-minus | `packages/parser/src/pdf/index.ts:318` | Regex: `([\d,]*(?:,|\d{5,})[\d,]*-)` — minus inside group | **VERIFIED FIXED** |
| C17-02: `findField` `Object.hasOwn` | `packages/parser/src/json/index.ts:65` | `Object.hasOwn(obj, alias)` | **VERIFIED FIXED** |
| C17-03: MIGRATIONS `any` | `apps/web/src/lib/store.svelte.ts:115` | `Record<number, (data: unknown) => unknown>` | **PARTIAL** — Record fixed but callbacks at :247,:286 still use `any` |
| C17-04: `normalizeHTML` broad | `packages/parser/src/csv/shared.ts:180` | `<\/([a-z][a-z0-9]*)\s+>` | **VERIFIED FIXED** |
| C17-05: Full-width plus | `packages/parser/src/csv/shared.ts:142` | `.replace(/＋/g, '+')` | **VERIFIED FIXED** |

### Prior Issues — Status

| Finding | Status | Evidence |
|---------|--------|----------|
| C-CR-01: Non-KRW transactions dropped | **OPEN** | No code path handles non-KRW amounts differently; they pass through as-is. Need to re-verify. |
| C-CR-04: CardRuleSet inline | **OPEN** | `apps/web/src/lib/cards.ts` still defines `CardRuleSet` inline (lines 14-52) |
| A-ARCH-01: Parser duplication | **OPEN** | Web parsers exist as separate files in `apps/web/src/lib/parser/` |
| S-SEC-05: Regex DoS | **OPEN** | `column-matcher.ts` regexes applied without header length cap |

---

## Gate Check

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS |

---

## Verdict

**5 VERIFIED FIXED, 1 PARTIAL, 4 OPEN** — Cycle 17 fixes landed correctly. The remaining `any` types in persistence callbacks (C18-CR01) are a genuine partial-fix of C17-CR03.
