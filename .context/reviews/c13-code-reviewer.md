# Code Reviewer — cherrypicker (Cycle 13)

**Reviewer:** code-reviewer
**Scope:** Full repository: packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools
**Date:** 2026-05-05

---

## Summary

Cycle 13 resolves four significant findings from Cycle 12. The adapter-factory date validation gap (C12-01/C12-06) is fixed, the web XLSX parser now uses shared `findColumn` (C12-02), and column-matcher has comprehensive test coverage (T12-01). One new correctness issue found in the PDF fallback parser (C13-04). Minor syntax debris (double semicolons) noted.

---

## Verified Fixed

| Finding | File | Evidence |
|---------|------|----------|
| C12-01: Silent swallow of unparseable dates | `packages/parser/src/csv/adapter-factory.ts:158-160` | Now calls `isValidISODate(parsedDate)` and pushes `ParseError` when unparseable |
| C12-06: Adapter-factory missing isValidISODate | `packages/parser/src/csv/adapter-factory.ts:158-160` | Same fix as C12-01 — validates after `parseDateStringToISO` |
| C12-02: Web XLSX local findCol | `apps/web/src/lib/parser/xlsx.ts:7` | Now imports `findColumn` from `./column-matcher.js` |
| T12-01: Zero column-matcher tests | `packages/parser/__tests__/column-matcher.test.ts` | 2548 lines, 1408+ bun tests covering all patterns |

---

## New Findings

### [C13-04-MEDIUM] PDF fallback amount pattern loses trailing minus sign

**File:** `apps/web/src/lib/parser/pdf.ts:565`
**Confidence:** High

The `fallbackAmountPattern` group 6 is `([\d,]*(?:,|\d{5,})[\d,]*)-` — the trailing minus sign is OUTSIDE the capture group. When this alternative matches (e.g., `"1,234-"`), `amountMatch[6]` contains only `"1,234"` without the minus.

At line 604, `amountRaw` pulls from capture groups:
```javascript
const amountRaw = (amountMatch[1] ?? amountMatch[2] ?? amountMatch[3] ?? amountMatch[4] ?? amountMatch[5] ?? amountMatch[6] ?? amountMatch[7])!;
```

Then `parseAmount(amountRaw)` at line 605 receives `"1,234"`. The `parseAmount` function's trailing-minus detection (`/\d-$/`) fails because the minus was stripped by the regex. The amount is returned as positive, and line 613's `amount > 0` check passes, treating a refund/negative as positive spending.

**Fix:** Include the trailing `-` in group 6's capture: `([\d,]*(?:,|\d{5,})[\d,]*-)` or use `amountMatch[0]` when group 6 is the match source.

---

### [C13-CR01-LOW] Double semicolon syntax debris

**Files:**
- `packages/parser/src/csv/adapter-factory.ts:7` — `import { ParseError } from '../types.js';;`
- `packages/parser/src/csv/generic.ts:2` — `import { ParseError } from '../types.js';;`

**Confidence:** High

Harmless syntax debris — TypeScript parses `;;` as an empty statement. No runtime effect.

**Fix:** Remove extra semicolons.

---

## Re-confirmed (deferred)

| ID | Severity | Description |
|---|---|---|
| C7-01 | MEDIUM | CATEGORY_NAMES_KO drift across 4+ locations |
| C7-02 | LOW | FALLBACK_CATEGORY_LABELS duplicate |
| C9-01 | MEDIUM | CATEGORY_COLORS fourth duplicate |
| D-01 | MEDIUM | Parser duplication (web vs packages) |
| D-02 | MEDIUM | README MIT vs LICENSE Apache 2.0 mismatch |
| C12-04 | Low-Medium | isDateLike doesn't allow spaces around delimiters |
| C12-05 | LOW | Web XLSX BANK_COLUMN_CONFIGS duplication |

---

## Gate Evidence

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS (1408 tests)
- `npx vitest run` — PASS (322 tests)
