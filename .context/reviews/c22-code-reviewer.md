# Cycle 22 — Code Reviewer

**Date:** 2026-05-05
**Scope:** packages/parser/, apps/web/src/lib/parser/, apps/web/src/lib/store.svelte.ts
**Previous:** 21 cycles completed

---

## Finding C22-CR01: Web-side Korean character regex extends beyond valid Hangul [LOW]

**File:** `apps/web/src/lib/parser/csv.ts:316`

**Problem:** The `hasNonNumeric` check uses `/[가-힯a-zA-Z]/` where `힯` extends 12 code points beyond the last valid Hangul syllable `힣` (U+D7A3, 힣). The server-side equivalent at `packages/parser/src/csv/generic.ts:110` correctly uses `/[가-힣a-zA-Z]/` which maps to `가-힣`.

This means the web-side matches unassigned Unicode code points (U+D7A4 through U+D7AF) as "Korean text" during header row detection. While unlikely to cause false positives in practice, it is a parity inconsistency that could theoretically allow malformed content to pass the header-detection heuristic.

**Fix:** Change `힯` to `힣` in the web-side regex.

**Confidence:** High

---

## Finding C22-CR02: HTML forward-fill uses loose equality `!= null` [LOW]

**File:** `apps/web/src/lib/parser/html.ts:151-152` (and server-side `packages/parser/src/html/index.ts:146-147`)

**Problem:** The `isNonEmpty` helper uses `val != null` (loose equality) which treats both `null` and `undefined` as falsy. While this is intentional for empty-cell detection, the mixing of loose equality (`!= null`) with strict equality (`!== ''`) in the same expression is slightly inconsistent with the codebase's general preference for strict equality.

**Fix:** Consider using `val !== undefined && val !== null` for explicitness, or document why loose equality is intentionally used here.

**Confidence:** Low (style/consistency only)

---

## Finding C22-CR03: Web-side JSON parser preserves negative amounts without absolute value [LOW — BEHAVIORAL NOTE]

**File:** `apps/web/src/lib/parser/json.ts:98-100`

**Problem:** The comment says "Negative amounts (refunds/credits) are preserved — the optimizer's positive-only filter handles them." However, the server-side JSON parser (`packages/parser/src/json/index.ts:114-115`) has the identical code and comment. Both parsers preserve negative amounts and rely on the optimizer's `tx.amount > 0` filter (in `greedy.ts:198`) to exclude them.

This is a cross-package dependency that could break if the optimizer's filter is ever removed or changed. A more robust approach would be to filter at the parser level, keeping the contract that all parser outputs have positive amounts.

**Fix:** Add `amount = Math.abs(amount)` in the JSON parser after validation, or add an invariant check at the optimizer entry point.

**Confidence:** Medium

---

## Commonly Missed Issues Sweep

- No `Math.max(...spread)` patterns remain (fixed in cycles 21-22).
- No `eval` or `Function()` usage in production code.
- No explicit `any` types in parser code.
- All try/catch blocks either handle errors meaningfully or document why silent swallowing is safe.
- No unused imports detected in recently changed files.

---

## Regressions

None found. All gates pass (lint, typecheck, bun tests, vitest).
