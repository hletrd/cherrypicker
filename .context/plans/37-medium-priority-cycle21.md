# Plan 37 — Medium/Low-Priority Fixes (Cycle 21)

**Priority:** MEDIUM/LOW
**Findings addressed:** C21-02, C21-06
**Status:** TODO

---

## Task 1: Standardize rate formatting precision across dashboard components (C21-02)

**Finding:** C21-02 — `SavingsComparison.svelte:150` uses `formatRatePrecise` (2dp) for the best single card rate, while `OptimalCardMap.svelte:117` uses `formatRate` (1dp). This inconsistency means the same rate shows different precision in different views.

**Files:**
- `apps/web/src/components/dashboard/SavingsComparison.svelte:150`
- `apps/web/src/components/dashboard/OptimalCardMap.svelte:117`

**Implementation:**

Use `formatRatePrecise` consistently in SavingsComparison for the effective rate display, since this component already uses it for the cherry-pick rate. Change the bestSingleCard rate display from `formatRate` to `formatRatePrecise`:

```svelte
<!-- Line 150 in SavingsComparison.svelte -->
월 혜택{#if opt.totalSpending > 0}, 혜택률 {formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)}{/if}
```

Wait — actually line 150 already uses `formatRatePrecise`. Let me re-check. The inconsistency is that SavingsComparison uses `formatRatePrecise` for its own effective rate display, while OptimalCardMap uses `formatRate` for per-category rates. This is actually intentional — category-level rates benefit from less precision (1dp is enough), while the overall effective rate benefits from more precision. Closing as "by design."

**Status:** WITHDRAWN — The different precision levels are intentional. Category rates (1dp) don't need the extra precision; overall rates (2dp) benefit from it.

---

## Task 2: Replace `Math.max(...array)` with `array.reduce()` in pdf.ts (C21-06)

**Finding:** C21-06 — `Math.max(...lines.map((l) => l.length))` in `pdf.ts:26` risks stack overflow for very large PDFs. Same class as D-73/D-89.

**File:** `apps/web/src/lib/parser/pdf.ts:26`

**Implementation:**

Replace:
```ts
const maxLen = Math.max(...lines.map((l) => l.length));
```

With:
```ts
const maxLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
```

**Commit:** `fix(parser): 🐛 replace Math.max spread with reduce to avoid stack overflow in PDF column detection`

---

## Deferred Items from This Cycle

### C21-03: Third hardcoded copy of bank names in FileDropzone

- **Original finding:** C21-03
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:72-97`
- **Reason for deferral:** Same class as D-42/D-57. The hardcoded bank list in FileDropzone covers all current banks. Deriving from `cards.json` issuers requires architectural changes (making the issuer data available at the component level, or creating a shared bank constants module). New banks are rare and the current list is functional.
- **Exit criterion:** When D-42 is resolved (dynamic data source lookup), apply the same pattern to FileDropzone's bank list.

### C21-04: Fee sort ignores international annual fee (WITHDRAWN)

- **Original finding:** C21-04 (same as C20-06)
- **Status:** ALREADY FIXED — `CardGrid.svelte:63,65` already includes international fee as secondary sort key. The review incorrectly listed this as not fixed.

---

## Progress

- [x] Task 1: WITHDRAWN — intentional design choice
- [x] Task 2: Replace Math.max spread in pdf.ts
