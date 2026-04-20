# Plan: Cycle 3 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle3-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [MEDIUM] Fix CategoryBreakdown keyboard accessibility -- hoveredIndex not cleared on focus loss (C3-03)

**File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:153-161`
**Problem:** The `hoveredIndex` state is managed by both mouse events (`onmouseenter`/`onmouseleave`) and keyboard/click events (`onclick`/`onkeydown`). When a keyboard user expands a row via Enter/Space, then tabs to the next row, the previous row stays expanded because `onmouseleave` never fires for keyboard focus changes. This results in multiple rows appearing "expanded" simultaneously.
**Fix:** Replace the dual mouse/keyboard pattern with a unified approach:
- Keep `onmouseenter`/`onmouseleave` for mouse hover (as-is)
- Add `onfocusin`/`onfocusout` handlers that mirror mouse behavior for keyboard navigation
- When a keyboard user focuses a row, set `hoveredIndex` to that row index
- When focus leaves the row (without entering a child element), clear `hoveredIndex`

Specifically:
```svelte
onfocusin={() => (hoveredIndex = i)}
onfocusout={(e) => {
  // Only collapse if focus is leaving this row entirely (not moving to a child)
  if (!e.currentTarget?.contains(e.relatedTarget as Node)) {
    hoveredIndex = null;
  }
}}
```
**Status:** DONE

### 2. [LOW] Fix store.svelte.ts missing sessionStorage cleanup when reoptimize fails with null result (C3-05)

**File:** `apps/web/src/lib/store.svelte.ts:405-420`
**Problem:** When `reoptimize` is called and `result` is null (store was reset while reoptimizing), the error message is set but the stale data in sessionStorage is NOT cleared. If the user refreshes the page, they'll see stale pre-edit data from sessionStorage.
**Fix:** Add `clearStorage()` call in the `else` branch where `result` is null:
```ts
} else {
  // Store was reset while reoptimizing — cannot apply edits
  // Clear stale sessionStorage data to prevent confusion on refresh
  clearStorage();
  error = '분석 결과가 없어요. 다시 분석해 보세요.';
}
```
**Status:** DONE

### 3. [LOW] Fix SavingsComparison unnecessary RAF loop when target equals current value (C3-02)

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:53-70`
**Problem:** The `$effect` that animates `displayedSavings` creates a requestAnimationFrame loop even when `target === displayedSavings` (no animation needed). The early return on line 55 only covers the case where both are zero.
**Fix:** Add an early return when target equals current displayed value:
```ts
$effect(() => {
  const target = opt?.savingsVsSingleCard ?? 0;
  if (target === 0 && displayedSavings === 0) return;
  if (target === displayedSavings) return; // No animation needed
  // ... rest of animation logic
});
```
**Status:** DONE

### 4. [LOW] Fix build-stats.ts misleading error message for malformed JSON (C3-01)

**File:** `apps/web/src/lib/build-stats.ts:25`
**Problem:** The `catch (err)` block always logs "cards.json not found at build time" regardless of whether the error is a missing file (ENOENT) or malformed JSON (SyntaxError). This is misleading during development.
**Fix:** Differentiate error types in the catch block:
```ts
} catch (err) {
  if (err instanceof SyntaxError) {
    console.warn('[cherrypicker] cards.json is malformed at build time, using fallback stats:', err.message);
  } else {
    console.warn('[cherrypicker] cards.json not found at build time, using fallback stats:', err);
  }
}
```
**Status:** PENDING

### 5. [LOW] Fix OptimalCardMap rate bar visual distortion when all rates are near-zero (C3-04)

**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:17-24`
**Problem:** The `maxRate` guard uses epsilon `0.0001` (0.01%) which is too small. When all rates are genuinely near-zero, every bar gets 100% width because the denominator is the tiny epsilon. This makes tiny rates look disproportionately large.
**Fix:** Use a more reasonable minimum maxRate that reflects the visual scale of rate bars:
```ts
return computed > 0.005 ? computed : 0.005; // Minimum 0.5% for bar scaling
```
This ensures that when all rates are below 0.5%, the bars are proportionally small rather than full-width.
**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C52-03/C4-06/C9-02 | LOW severity; annual projection label partially addressed with "최근 월 기준" caveat; UX team input needed | UX review recommends different label |
| C52-04/C4-14 | LOW severity; fallback values now centralized in shared module; only affects build-time failures | cards.json becomes unavailable at build time |
| C52-05/C4-09 | LOW severity; dark mode contrast is acceptable for most colors; only 2-3 very dark entries affected; design token migration is a larger effort | Design system integration planned |
| C4-10 | MEDIUM severity but E2E test infrastructure change; out of scope for this cycle | E2E test framework refactor |
| C4-11 | MEDIUM severity but requires new test infrastructure; out of scope | Test coverage sprint |
| C4-13 | LOW severity; visual polish; small bars still visible at wider widths | Design review |
| C9-04 | LOW severity; complex regex works correctly for all known PDF formats | PDF parser rewrite |
| C9-06 | LOW severity; rounding affects only edge cases with many tiny categories | Threshold adjustment PR |
| C9-07 | LOW severity; theoretical; no real datasets approach the limit | Large dataset reported |
| C9-08 | LOW severity; comparison bars are correct when both rewards are 0 | UX review |
| C9-09 | LOW severity; categories cache is static JSON; invalidation not needed for current use case | Dynamic category loading implemented |
| C9-10 | LOW severity; double-decode is harmless; re-encode is defensive | XLSX parser refactor |
| C9-12 | LOW severity; module-level cache is intentional for static JSON data | Store architecture change |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable since any parsing error should result in null return (falling through to fallback) | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
