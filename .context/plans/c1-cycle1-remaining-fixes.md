# Cycle 1 Remaining Fixes Plan -- 2026-04-22

**Date**: 2026-04-22
**Source**: `.context/reviews/2026-04-22-cycle1-comprehensive.md` and `.context/reviews/_aggregate.md`

## Scheduled Fixes (this cycle)

### Fix 1: KakaoBank WCAG AA Contrast (C1-03/C90-02)

- **Severity**: LOW (accessibility)
- **File**: `apps/web/src/lib/formatters.ts:127` (getIssuerColor)
- **Problem**: KakaoBank issuer badge uses `#fee500` (yellow) background with white text. The contrast ratio of white (#ffffff) on #fee500 is approximately 1.56:1, which fails WCAG AA (requires 4.5:1 for normal text).
- **Fix**: Change KakaoBank badge text from white to dark (#1a1a1a) when the issuer is `kakao`. The cleanest approach is to add a helper function `getIssuerTextColor(issuer)` that returns dark text for light backgrounds. KakaoBank #fee500 with #1a1a1a text gives a contrast ratio of ~13.5:1, well above WCAG AA.
- **Effort**: Small

### Fix 2: Add getIssuerTextColor helper for all light-on-dark badge scenarios

- **Severity**: LOW (accessibility robustness)
- **File**: `apps/web/src/lib/formatters.ts`
- **Problem**: Currently all issuer badges use `text-white` regardless of background color. While most issuer colors are dark enough for white text, some (kakao #fee500, jeju #ff6b00) are borderline or failing WCAG AA.
- **Fix**: Add `getIssuerTextColor(issuer: string): string` function that returns `'text-white'` or `'text-gray-900'` based on the issuer's background luminance. Apply in SavingsComparison, ReportContent, and CategoryBreakdown where issuer badges appear.
- **Effort**: Small

### Fix 3: VisibilityToggle classList.toggle isConnected guard (C89-01)

- **Severity**: LOW (robustness)
- **File**: `apps/web/src/components/ui/VisibilityToggle.svelte:70-71`
- **Problem**: `classList.toggle` called without checking `isConnected`, which could affect a detached element during Astro View Transition re-mounts.
- **Fix**: Add `if (el.isConnected)` guard before classList.toggle calls.
- **Effort**: Small

### Fix 4: formatters.ts non-null assertion removal (C89-03)

- **Severity**: LOW (type safety)
- **File**: `apps/web/src/lib/formatters.ts:155-157`
- **Problem**: `m!` non-null assertion used after a length check. While safe at runtime (a 2-element array always has indices 0 and 1), the non-null assertion bypasses TypeScript's null checking.
- **Fix**: Replace `m!` with optional chaining or explicit assertion using the length check.
- **Effort**: Small

## Deferred Items (from this cycle's review)

| ID | Reason | Exit Criterion |
|---|---|---|
| C1-N01 | formatIssuerNameKo drift is same pattern as CATEGORY_NAMES_KO; requires build-time codegen solution | Implement codegen step (same exit as CF-13) |
| C1-N02 | CATEGORY_COLORS drift same pattern; requires codegen | Implement codegen step (same exit as CF-13) |
| C1-N03 | RAF cancelAnimationFrame(undefined) is a no-op, not harmful | If animation glitches reported, add RAF ID tracking |
| C1-N04 | Parser duplication same as CF-01/D-01 | D-01 shared package created |

## Previously Deferred Items (unchanged)

All items from `00-deferred-items.md` (D-01 through D-09) and `c1-cycle1-fixes.md` deferred section remain unchanged.
