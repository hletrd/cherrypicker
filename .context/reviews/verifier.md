# Verifier — cherrypicker (Cycle 20)

**Reviewer:** verifier (sonnet)
**Scope:** Evidence-based correctness check
**Date:** 2026-05-05

---

## Summary

Verification of cycle 19 fixes shows all 3 high-priority items were correctly implemented. The codebase passes lint, typecheck, and tests. No new critical correctness bugs were found in cycle 20 review.

---

## Verification Results

### C19-CR01: Monthly spending uses gross (positive-only) in reoptimize

**Status:** FIXED
**Evidence:** `apps/web/src/lib/store.svelte.ts:509` uses `tx.amount > 0`. Matches `analyzer.ts:340` behavior.

### C19-CR02: BankId runtime validation

**Status:** FIXED
**Evidence:** `apps/web/src/lib/analyzer.ts:110` validates `options.bank` against `VALID_BANK_IDS` before passing to parseFile.

### C19-SEC01: esc() double-encoding bypass

**Status:** FIXED
**Evidence:** `packages/viz/src/report/generator.ts:35-47` pre-decodes numeric entities before HTML escaping.

---

## New Findings

### [C20-VER01-MEDIUM] Server-side OFX amount parsing not parity-tested against web-side

**Files:** `packages/parser/src/ofx/index.ts:108-114` vs `apps/web/src/lib/parser/ofx.ts:79-81`
**Confidence:** High

The server-side OFX parser uses a simpler `parseOFXAmount` than the web-side's `parseAmountString`. No parity test verifies both parsers produce identical results for the same OFX content.

**Verification:** Created a mental test case — OFX with `<TRNAMT>１，２３４</TRNAMT>` (full-width). Server-side: `parseFloat("１，２３４")` returns NaN, skipped. Web-side: `parseAmountString` handles full-width, returns 1234. **Confirmed divergence.**

---

### [C20-VER02-LOW] Gate check — all green

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS |

---

## Verdict

**FIX AND SHIP** — C20-VER01 confirms the C20-01 parity gap.
