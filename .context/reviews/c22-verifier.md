# Cycle 22 — Verifier

**Date:** 2026-05-05
**Scope:** packages/parser/, apps/web/src/lib/parser/
**Previous:** 21 cycles completed

---

## Verification of Commit 8fb7603 Fixes

Commit 8fb7603 ("fix(parser): web-side parity: HTML forward-fill, JSON negative amounts, OFX CCSTMTRS, shared normalizeHTML") introduced four fixes. I verified each:

### Fix 1: HTML forward-fill for merged cells (web-side)
**Status:** VERIFIED
- `apps/web/src/lib/parser/html.ts:91-268` contains forward-fill logic for all 6 columns (date, merchant, category, installments, memo, amount).
- Matches server-side `packages/parser/src/html/index.ts:134-217` logic.
- Summary row reset at lines 160-169 prevents contamination.

### Fix 2: JSON negative amounts
**Status:** VERIFIED
- `apps/web/src/lib/parser/json.ts:100` uses `if (amount === 0) return null;` — preserves negative amounts.
- Server-side `packages/parser/src/json/index.ts:115` identical.
- Optimizer at `packages/core/src/optimizer/greedy.ts:198` filters `tx.amount > 0`.

### Fix 3: OFX CCSTMTRS/CREDITCARDMSGSRSV1 terminators
**Status:** VERIFIED
- `apps/web/src/lib/parser/ofx.ts:22` includes `</CCSTMTRS` and `</CREDITCARDMSGSRSV1` in SGML terminators.
- Server-side `packages/parser/src/ofx/index.ts:47` identical.
- ORG bank detection at `apps/web/src/lib/parser/ofx.ts:99-104` matches server-side.

### Fix 4: Shared normalizeHTML
**Status:** PARTIALLY VERIFIED
- Server-side `packages/parser/src/csv/shared.ts:181` exports `normalizeHTML`.
- Server-side HTML parser imports from shared.ts.
- Server-side XLSX parser imports from shared.ts.
- **Web-side still has its own copy** in `apps/web/src/lib/parser/html.ts:29-43`.
- **Web-side XLSX parser imports from `./html.js`** (web-side copy), not a shared module.

The extraction is complete on the server side but incomplete on the web side. The web-side copy is kept in sync manually.

---

## Verification of Cycle 21 Fixes

| Fix | Status | Evidence |
|-----|--------|----------|
| C21-01 (XLSX parseAmountString) | VERIFIED | `apps/web/src/lib/parser/xlsx.ts:6` imports `parseAmountString` from `./csv.js` |
| C21-02 (format detection sniffing) | VERIFIED | `apps/web/src/lib/parser/detect.ts:115-141` has content sniffing for unknown extensions |
| C21-03 (full-width plus) | VERIFIED | `apps/web/src/lib/parser/csv.ts:128` has `.replace(/＋/g, '+')` |
| C21-TEST01-04 | VERIFIED | Tests exist and pass in `apps/web/__tests__/` |

---

## Regressions

None found. All 499 bun + 239 vitest tests pass. Lint and typecheck clean.
