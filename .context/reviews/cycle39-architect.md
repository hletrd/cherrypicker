# Architecture Review — CherryPicker Cycle 39

**Reviewer:** architect (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### ARCH-39-01 — Low — Parser duplication debt continues to grow

**Files:** `apps/web/src/lib/parser/*.ts` vs `packages/parser/src/*/*.ts`

The web-side parser suite now includes near-duplicates of:
- HTML parser (`html.ts` ~295 lines vs server `html/index.ts` ~286 lines)
- OFX parser (`ofx.ts` ~182 lines vs server `ofx/index.ts` ~243 lines)
- JSON parser (`json.ts` ~233 lines vs server `json/index.ts` ~254 lines)
- XLSX parser (`xlsx.ts` ~637 lines vs server `xlsx/index.ts` ~461 lines)

The only meaningful differences are:
- `Buffer` (Node) vs `TextEncoder`/`ArrayBuffer` (browser)
- `fs/promises.readFile` vs `file.arrayBuffer()` / `file.text()`

**Problem:** Every bug fix, feature addition, or behavior change must be manually applied in two places. The "parity" comments (e.g., C98-02, C100-01) are a poor substitute for shared code. After 39 cycles, the duplication has grown to ~1500+ lines of near-identical logic.

**Risk:** Inconsistency bugs (like BUG-38-01 where HTML/XLSX silently skipped amounts while JSON/OFX reported errors) will keep recurring.

**Recommendation:** Extract platform-agnostic parsing logic into shared utilities:
- `parseAmountString` → already shared (C97-02)
- `normalizeHTML` → partially shared but diverged
- Column matching, forward-fill, header detection → already shared via `column-matcher.ts`
- The remaining duplication is mainly SheetJS workbook → transaction conversion

A shared `@cherrypicker/parser-core` package that accepts `Uint8Array | string` and returns `ParseResult` would eliminate most duplication. Platform-specific wrappers would handle I/O only.

**Confidence:** High

---

### ARCH-39-02 — Low — `calculateRewards` lacks input validation

**File:** `packages/core/src/calculator/reward.ts:185-376`

The core calculation function accepts `CalculationInput` with no validation of:
- `previousMonthSpending` being finite and non-negative (see BUG-39-01)
- `transactions` array being non-empty
- `cardRule` having valid structure

**Problem:** The core package is advertised as "Pure TS, no runtime-specific APIs" and is meant to be reusable. Without input validation, callers can pass malformed data and get silently wrong results.

**Fix:** Add defensive validation at the function entry point. These are runtime assertions, not type checks — TypeScript can't catch NaN at compile time.

**Confidence:** Medium

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| ARCH-37-01 | OPEN | Parser duplication ~1500+ lines, growing |
| CR-07/CR-17 | DEFERRED | Type unification + parser dedup deferred |
