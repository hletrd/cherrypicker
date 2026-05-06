# Cycle 27 Implementation Plan — High Priority

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/c27-aggregate.md`, `.context/reviews/c27-{code-reviewer,debugger,test-engineer,security-reviewer,architect,verifier}.md`
**Status:** Complete

---

## Task 1: Add forward-fill reset on summary rows to server XLSX parser [C27-COR01] — MEDIUM ✅

- **Files:** `packages/parser/src/xlsx/index.ts:325`
- The server XLSX parser skips summary rows via `continue` but does not reset forward-fill state. Parity with HTML parser fix (C25-COR01).
- **Change:** Wrap the `continue` in a block that resets `lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount` to `''` before continuing.
- Add comment: `// Reset forward-fill state so summary row values don't propagate to merged data cells below (C27-COR01).`
- **Commit:** `3e974e6`

## Task 2: Add forward-fill reset on summary rows to web XLSX parser [C27-COR02] — MEDIUM ✅

- **Files:** `apps/web/src/lib/parser/xlsx.ts:484`
- Same bug as C27-COR01 in the web-side XLSX parser.
- **Change:** Same reset pattern as C27-COR01.
- **Commit:** `3e974e6` (combined with C27-COR01)

## Task 3: Extract shared parseAmount in web parsers [C27-COR03] — LOW ✅

- **Files:** `apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/pdf.ts`, new file `apps/web/src/lib/parser/amount.ts`
- Both files define nearly identical `parseAmount` logic.
- **Change:**
  1. Create `apps/web/src/lib/parser/amount.ts` with the shared `parseAmount` function.
  2. Update `apps/web/src/lib/parser/csv.ts` to import `parseAmount` from `./amount.js` and export aliases `parseCSVAmount` and `parseAmountString` that re-export it.
  3. Update `apps/web/src/lib/parser/pdf.ts` to import `parseAmount` from `./amount.js`.
  4. Ensure `apps/web/src/lib/parser/json.ts` import of `parseAmountString` still works (it imports from `./csv.js`).
  5. Ensure `apps/web/src/lib/parser/html.ts` import of `parseAmountString` still works (it imports from `./csv.js`).
  6. Ensure `apps/web/src/lib/parser/ofx.ts` import of `parseAmountString` still works (it imports from `./csv.js`).
- **Commit:** `bdd51ae`

## Task 4: Add server test for XLSX summary row forward-fill reset [C27-TEST01] — LOW ✅

- **Files:** `packages/parser/__tests__/xlsx.test.ts`
- Add test: an XLSX sheet with a summary row between two data groups with merged cells should reset forward-fill state, preventing summary values from propagating to subsequent rows.
- **Commit:** `f32827f`

## Task 5: Add try/catch defense to OFX regex construction [C27-SEC02] — LOW (optional)

- **Files:** `packages/parser/src/ofx/index.ts:65-76`, `apps/web/src/lib/parser/ofx.ts:40-46`
- Wrap `new RegExp(...)` calls in try/catch as defense-in-depth against future regressions in `escapeRegExp`.
- **Decision:** Optional — low impact, can be deferred if time-constrained.

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C27-ARCH01 | LOW | Medium | Decouple normalizeHTML from HTML module. Requires extracting to shared utility and updating imports across both server and web XLSX parsers. Architectural improvement, not correctness fix. | normalizeHTML is extracted to shared module |
| C27-SEC01 | LOW | Medium | XLSX coupled to HTML sanitizer is same root cause as C27-ARCH01. Defer together. | C27-ARCH01 is implemented |
| C27-TEST02 | LOW | Medium | No web-side XLSX tests exist at all. Adding full test coverage is a larger effort than this cycle. | Web-side XLSX parser has dedicated test file |
| A-ARCH-01 | CRITICAL | High | Server/web parser duplication carry-over. Requires dedicated refactor cycle. | Dedicated refactor cycle with design doc |
| C25-PERF01 | LOW | High | Greedy optimizer double calculation carry-over. | User reports slow optimization |
| C25-TEST03 | LOW | Medium | Reoptimize metadata test requires complex mocking. | Store has testable exports or test file |

---

## Gate Results

- `npm run lint`: PASS (all workspaces tsc --noEmit clean, astro check 0 warnings 0 hints)
- `npm run typecheck`: PASS (all workspaces tsc --noEmit clean, astro check 0 warnings 0 hints)
- `bun run test`: PASS (1520 pass, 0 fail across parser/core/rules/viz packages; 11 successful turbo tasks overall)
