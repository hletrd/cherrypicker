# Plan 11 — Medium-Priority Fixes (Cycle 6)

**Priority:** MEDIUM
**Findings addressed:** C6-03, C6-11
**Status:** DONE

---

## Task 1: Smooth count-up animation on re-render (C6-03)

**Finding:** `SavingsComparison.svelte:53-68` — When `opt?.savingsVsSingleCard` changes after reoptimization, the count-up animation resets to 0 then animates up. This creates a jarring visual for small changes.

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte`

**Implementation:**
1. Track the previous savings target and start from the current displayed value:
```ts
let prevSavingsTarget = 0;
$effect(() => {
  const target = opt?.savingsVsSingleCard ?? 0;
  if (target === 0) { displayedSavings = 0; prevSavingsTarget = 0; return; }
  const startVal = displayedSavings;
  let cancelled = false;
  let rafId: number;
  const start = performance.now();
  const duration = 600;
  function tick(now: number) {
    if (cancelled) return;
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    displayedSavings = Math.round(startVal + (target - startVal) * eased);
    if (progress < 1) rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  prevSavingsTarget = target;
  return () => { cancelled = true; cancelAnimationFrame(rafId); };
});
```

**Commit:** `fix(web): ✨ smooth savings counter animation on re-render instead of resetting`

---

## Task 2: Add `formatRatePrecise` helper for 2-decimal rate display (C6-11)

**Finding:** `SavingsComparison.svelte:161` — Inline rate formatting `(opt.effectiveRate * 100).toFixed(2)` gives 2 decimal places, while `formatRate()` gives 1. The inconsistency could cause precision loss if a developer switches to `formatRate()`.

**File:** `apps/web/src/lib/formatters.ts`

**Implementation:**
1. Add a `formatRatePrecise` helper:
```ts
/**
 * Format a decimal rate as percentage with 2 decimal places.
 * Use for effective rate displays that need more precision than formatRate().
 * Example: 0.01525 → "1.53%"
 */
export function formatRatePrecise(rate: number): string {
  if (!Number.isFinite(rate)) return '0.00%';
  return (rate * 100).toFixed(2) + '%';
}
```

2. In `SavingsComparison.svelte`, replace the inline calculation with the helper:
```svelte
<!-- Line 161: Change from -->
{(opt.effectiveRate * 100).toFixed(2)}%
<!-- To -->
{formatRatePrecise(opt.effectiveRate)}
```

3. Import `formatRatePrecise` in the component script.

**Commit:** `refactor(web): ♻️ add formatRatePrecise helper and use it in SavingsComparison`

---

## Progress

- [x] Task 1: Smooth count-up animation — `000000053b0953af2d17690ab9328ad54bda0f0c`
- [x] Task 2: Add formatRatePrecise helper — `000000041969bd6f0272166a5ba9f0b53c771627`
