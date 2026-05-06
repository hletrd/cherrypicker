# Cycle 28 Implementation Plan

**Date:** 2026-05-05
**Source reviews:** `.context/reviews/cycle28-aggregate.md`, `.context/reviews/cycle28-{code-reviewer,test-engineer,architect,security-reviewer}.md`
**Status:** In Progress

---

## Task 1: Create server-side `amount.ts` shared module [C28-ARCH01, C28-CR01]

- **Files:** `packages/parser/src/amount.ts` (new), `packages/parser/src/index.ts`
- Create `packages/parser/src/amount.ts` that exports:
  - `parseAmountString(raw: string): number | null` — re-export from `csv/shared.ts`
  - `parseAmount(raw: unknown): number | null` — type-safe wrapper (handles number/string inputs, rounds numbers, delegates strings to `parseAmountString`)
- Update `packages/parser/src/index.ts` to export `parseAmount` and `parseAmountString` from `amount.ts`
- Update `packages/parser/src/xlsx/index.ts` to import `parseAmount` from `../amount.js` instead of defining locally
- Update `packages/parser/src/pdf/index.ts` to import `parseAmount` from `../amount.js` instead of aliasing `parseAmountString`
- Update `packages/parser/src/html/index.ts` to import `parseAmountString` from `../amount.js` instead of `../csv/shared.js`
- Update `packages/parser/src/ofx/index.ts` to import `parseAmountString` from `../amount.js` instead of `../csv/shared.js`
- Keep backward compatibility: `csv/shared.ts` still exports `parseAmountString` and `parseCSVAmount`

## Task 2: Fix `normalizeHTML` to strip `javascript:` URLs [C28-SEC01, C28-CR03]

- **Files:** `apps/web/src/lib/parser/html.ts`
- Add `.replace(/\s*(href|src)\s*=\s*["']?javascript:[^"'>\s]*/gi, '')` to the normalization chain
- Also apply to server-side `normalizeHTML` in `packages/parser/src/csv/shared.ts` for parity

## Task 3: Fix PDF fallback scanner dateMatch parity [C28-CR04]

- **Files:** `packages/parser/src/pdf/index.ts:376`
- Change `dateMatch[1]!` to `dateMatch[0]` to match web-side pattern
- Also verify the web-side pattern is consistent

## Task 4: Add dedicated tests for `parseAmount` [C28-TEST01, C28-TEST02]

- **Files:** `apps/web/__tests__/amount.test.ts` (new), `packages/parser/__tests__/amount.test.ts` (new)
- Test full-width digits, Won signs, KRW prefix, 마이너스, trailing minus, parenthesized negatives, comma separators, leading plus, empty/whitespace inputs, invalid inputs, decimal rounding
- Test server-side `parseAmount` wrapper with number inputs, non-finite inputs, null/undefined inputs

## Task 5: Add server-side `normalizeHTML` test for `javascript:` URLs

- **Files:** `packages/parser/__tests__/csv-shared.test.ts` or `apps/web/__tests__/parser-html.test.ts`
- Verify `javascript:` URLs are stripped from both web-side and server-side normalization

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C28-SEC02 | LOW | Medium | PDF size limit requires broader architectural change (configurable limits across all parsers). Out of scope for this cycle. | User reports OOM on large PDF uploads |

---

## Gate Results (to be filled after implementation)

- `npm run lint`: TBD
- `npm run typecheck`: TBD
- `bun run test`: TBD
