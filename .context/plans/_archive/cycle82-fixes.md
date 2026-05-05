# Cycle 82 Plan — Fixes from Review

## Task 1: Make TransactionReview $effect reads atomic via snapshot (C82-01)

**Severity:** MEDIUM | **Confidence:** MEDIUM
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:127-142`

**Problem:** The `$effect` at line 127 reads `analysisStore.generation` and `analysisStore.transactions` as separate reactive getter calls. These two reads are not atomic -- between them, the `result` backing store could change (e.g., during Astro View Transition re-mounts). The `generation` guard partially mitigates this, but the two reads are still not from the same snapshot of state.

**Fix:** Read `analysisStore.result` once into a local variable at the top of the effect, then derive both generation and transactions from the snapshot. This ensures both values come from the same logical point in time.

**Implementation:**
```typescript
$effect(() => {
  // Read the result once to get an atomic snapshot of both generation and transactions
  const currentResult = analysisStore.result;
  const gen = analysisStore.generation;
  const txs = currentResult?.transactions ?? [];
  if (gen !== lastSyncedGeneration) {
    if (txs.length > 0) {
      editedTxs = txs.map(tx => ({ ...tx }));
    } else {
      editedTxs = [];
    }
    hasEdits = false;
    lastSyncedGeneration = gen;
  }
});
```

**Status:** DONE

---

## Task 2: Fix SavingsComparison animation "dip" during rapid reoptimize (C82-02)

**Severity:** LOW | **Confidence:** HIGH
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:45-76`

**Problem:** The `$effect` at line 45 starts a `requestAnimationFrame` loop that reads `displayedSavings` as the animation start point. During rapid reoptimize clicks, two animation loops can overlap. Although the `cancelled` flag prevents the old loop from setting state, the `startVal` for the second loop reads `displayedSavings` at the time the effect fires, which may be a mid-animation value from the first loop. This causes the animation to "dip" or "jump" rather than smoothly transitioning.

**Fix:** Track the last *target* value separately from `displayedSavings`. When starting a new animation, always animate from the last target to the new target, not from the current displayed value.

**Implementation:**
```typescript
let displayedSavings = $state(0);
let displayedAnnualSavings = $state(0);
// Track the last target value so rapid re-renders animate from the
// previous target, not a mid-animation intermediate value (C82-02).
let lastTargetSavings = $state(0);
let lastTargetAnnual = $state(0);

$effect(() => {
  const target = opt?.savingsVsSingleCard ?? 0;
  if (target === 0 && displayedSavings === 0) return;
  if (target === lastTargetSavings) return;

  // Skip animation when the user prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    displayedSavings = target;
    displayedAnnualSavings = target * 12;
    lastTargetSavings = target;
    lastTargetAnnual = target * 12;
    return;
  }

  // Always animate from the last target (not the current displayed value)
  // to prevent "dips" during rapid reoptimize clicks (C82-02).
  const startVal = lastTargetSavings;
  const annualTarget = target * 12;
  const startAnnual = lastTargetAnnual;
  lastTargetSavings = target;
  lastTargetAnnual = annualTarget;
  
  let cancelled = false;
  let rafId: number;
  const start = performance.now();
  const duration = 600;
  function tick(now: number) {
    if (cancelled) return;
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayedSavings = Math.round(startVal + (target - startVal) * eased);
    displayedAnnualSavings = Math.round(startAnnual + (annualTarget - startAnnual) * eased);
    if (progress < 1) rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  return () => { cancelled = true; cancelAnimationFrame(rafId); };
});
```

**Status:** DONE

---

## Task 3: Fix SavingsComparison "+1원" flash at zero savings (C82-03)

**Severity:** LOW | **Confidence:** HIGH
**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:217`

**Problem:** During the count-up animation from a positive savings to 0, the animation passes through small positive values from rounding (e.g., 1 won). The sign-prefix logic uses `displayedSavings > 0`, causing a brief "+1원" flash before settling on "0원". A threshold check would prevent this.

**Fix:** Only show the `+` prefix when `displayedSavings` is meaningfully positive (>= 100 won, which is the minimum meaningful amount in Korean banking). Values below 100 during animation are just rounding artifacts.

**Implementation:**
Change line 217 from:
```
{displayedSavings > 0 && Math.abs(displayedSavings) >= 1 ? '+' : ''}{formatWon(displayedSavings)}
```
to:
```
{displayedSavings >= 100 ? '+' : ''}{formatWon(displayedSavings)}
```

**Status:** DONE

---

## Deferred Items from This Cycle

### C82-04: parseFile double memory for CSV (ArrayBuffer + decoded string)

- **Original finding:** C82-04
- **Severity:** LOW
- **Confidence:** MEDIUM
- **File+line:** `apps/web/src/lib/parser/index.ts:17-68`
- **Reason for deferral:** For CSV files, `parseFile` reads the file into an ArrayBuffer (~10MB) then decodes with TextDecoder into a JavaScript string (~30MB UTF-16), creating ~40MB peak memory for a 10MB file. Using `file.text()` directly would avoid the intermediate ArrayBuffer. However, the encoding detection heuristic requires comparing decoded outputs from multiple encodings (utf-8 vs cp949), which needs the raw ArrayBuffer. Switching to `file.text()` would lose the ability to try CP949 decoding. The 10MB file size limit bounds the peak memory at ~40MB, which is acceptable for a client-side app.
- **Exit criterion:** If memory usage becomes an issue on mobile devices with large CSV uploads, refactor to use streaming text decoding with encoding detection on a partial buffer.

### C82-05: VisibilityToggle direct DOM mutation (re-confirmation of C18-01/C76-04/C79-02)

- **Original finding:** C82-05 (re-confirmation of C18-01/C76-04/C79-02)
- **Severity:** LOW
- **Confidence:** HIGH
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:70-71,90-108,119-125`
- **Reason for deferral:** Same as prior deferrals. The pattern works correctly with the `isConnected` guard (C21-01) but bypasses Svelte's DOM diffing. The architectural fix (converting to a Svelte-only approach using reactive bindings) requires refactoring how the dashboard page and results page manage their data/empty state visibility, which is a significant structural change.
- **Exit criterion:** When the dashboard page is refactored to use Svelte-only state management (no server-rendered empty state divs), replace VisibilityToggle with Svelte reactive bindings.
