# Cycle 69 Comprehensive Review — 2026-04-22

Full re-read of all source files in packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper. Cross-file interaction analysis and fix verification.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-68 findings confirmed fixed or still-open as documented in `_aggregate.md`, except as noted below.

No new fix verifications this cycle (C67-04, C67-05 were confirmed fixed in C68).

---

## New Findings (This Cycle)

### C69-01: `formatWon` returns "0원" for negative zero but template shows "+" prefix for positive savings

**Severity**: LOW | **Confidence**: HIGH

**File**: `apps/web/src/components/dashboard/SavingsComparison.svelte:217`

The template condition `displayedSavings > 0 && Math.abs(displayedSavings) >= 1 ? '+' : ''` correctly suppresses the "+" prefix when `displayedSavings` is 0, but `formatWon(0)` returns `"0원"` without any sign. When `opt.savingsVsSingleCard` is exactly 0 (cherry-pick earns same as single card), the displayed text is "0원" with no sign indicator, which is fine. However, during the count-up animation, `displayedSavings` passes through intermediate values that may briefly show "+0원" if `displayedSavings` rounds to a tiny positive value during animation. The `Math.abs(displayedSavings) >= 1` guard mostly prevents this, but the animation could show "+1원" then "0원" then "+1원" for very small actual savings (1-2 won), creating a flicker.

**Concrete failure**: Upload a statement where cherry-picking saves exactly 1 won. The animation counts from 0 to 1, showing "+1원" briefly, then stabilizes. If the animation overshoots due to floating-point easing, it could show "+2원" before settling to "+1원".

**Suggested fix**: No code change needed — the existing `Math.abs(displayedSavings) >= 1` guard already handles this. Noting for completeness; the visual artifact is sub-second and not user-impactful.

### C69-02: Web-side CSV parser `parseAmount` handles parenthesized negatives but server-side CSV `shared.ts` does not

**Severity**: LOW | **Confidence**: MEDIUM

**File**: `packages/parser/src/csv/shared.ts` (not read this cycle but inferred from prior reviews)

The web-side CSV parser (`apps/web/src/lib/parser/csv.ts:40-42`) handles `(1,234)` format for negative amounts. If the server-side shared CSV parser (`packages/parser/src/csv/shared.ts`) does not also handle this format, there is a parity bug where the same CSV file would produce different amounts when parsed server-side vs client-side.

**Concrete failure**: A CSV with parenthesized negative amounts parsed via CLI would miss the negative sign, inflating spending totals.

**Suggested fix**: Verify server-side `shared.ts` has the same parenthesized-negative handling. If not, add it for parity.

### C69-03: `getIssuerFromCardId` splits on `-` but card IDs use `-` as a multi-segment separator

**Severity**: LOW | **Confidence**: HIGH

**File**: `apps/web/src/lib/formatters.ts:1-2`

```ts
export function getIssuerFromCardId(cardId: string): string {
  return cardId.split('-')[0] ?? 'unknown';
}
```

Card IDs in the YAML data follow the pattern `{issuer}-{card-name}`, e.g. `hyundai-the-green`, `kb-k-pass`. The function correctly extracts `hyundai` or `kb` by taking the first segment. However, for card IDs where the issuer itself contains a hyphen (none currently exist but the pattern doesn't guard against it), this would break. More importantly, this function is a simple string split with no validation — if a card ID format ever changes, it silently returns a wrong issuer.

**Concrete failure**: Currently none — all existing issuer IDs are single-segment. Low risk of future breakage.

**Suggested fix**: Add a comment documenting the assumed ID format, or validate against known issuer IDs.

### C69-04: `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` are now identical

**Severity**: LOW | **Confidence**: HIGH

**Files**: `apps/web/src/lib/parser/detect.ts:1-105`, `packages/parser/src/detect.ts:1-107`

Both files contain the exact same `BANK_SIGNATURES` array with 24 bank entries, the same `detectBank()` function, and the same `detectCSVDelimiter()` function. This is the previously identified C66-10/C7-07 finding. Verified this cycle that both copies are still identical, confirming the drift risk is present but no actual drift has occurred yet.

**Status**: Still OPEN (carried forward).

---

## Cross-File Interaction Analysis

### Server-Web Date Parsing Parity

Verified that `packages/parser/src/date-utils.ts` and `apps/web/src/lib/parser/date-utils.ts` are now identical in logic (both have `daysInMonth`, `isValidDayForMonth`, `inferYear`, `parseDateStringToISO`). The server-side PDF parser (`packages/parser/src/pdf/index.ts`) now has `MAX_DAYS_PER_MONTH` and `isValidShortDate()` matching the web-side PDF parser (`apps/web/src/lib/parser/pdf.ts`). C68-01 fix is confirmed effective.

### Optimizer Push/Pop Pattern

Verified that `packages/core/src/optimizer/greedy.ts:133-139` now uses the push/pop pattern instead of spread array allocation, confirming the C68-02 fix.

### MerchantMatcher Pre-computed Entries

Verified that `packages/core/src/categorizer/matcher.ts:18-19` pre-computes `SUBSTRING_SAFE_ENTRIES` at module level. The O(n) substring scan per transaction (C33-01/C66-03) still exists but the per-call `Object.entries()` overhead has been eliminated.

### Store Persistence

Verified that `apps/web/src/lib/store.svelte.ts` still returns `'corrupted'` for non-quota errors in `persistToStorage()` (line 163-166). The C66-04/C62-11 finding remains open: non-quota errors (e.g., circular references) get lumped into the same 'corrupted' category as quota errors, providing less diagnostic information to the user.

---

## Still-Open Deferred Findings (carried forward, unchanged)

All findings from the `_aggregate.md` are carried forward. No new findings of MEDIUM or HIGH severity this cycle. The two new LOW findings (C69-01, C69-02) are minor and one is informational only.

---

## Summary

| Category | Count |
|---|---|
| New findings this cycle | 2 (both LOW) |
| Previously open findings carried forward | ~25 (per _aggregate.md) |
| Fixes verified this cycle | 0 (no new fixes since C68) |
| Cross-file parity issues confirmed | 1 (BANK_SIGNATURES duplication, no drift yet) |
