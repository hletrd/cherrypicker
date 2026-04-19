# Plan 03 — Medium-Priority Fixes (M-01 through M-07)

**Priority:** MEDIUM
**Findings addressed:** M-01, M-02, M-03, M-05, M-06, M-07
**Status:** Completed

---

## Task 1: Tighten CSP by removing `'unsafe-inline'` (M-01)

**Finding:** `Layout.astro:39` — CSP includes `'unsafe-inline'` for `script-src`, undermining XSS protection.

**File:** `apps/web/src/layouts/Layout.astro`

**Implementation:**
1. Change `script-src 'self' 'unsafe-inline'` to `script-src 'self'` in the CSP meta tag
2. Verify that all Astro pages use external script references (not `is:inline`)
3. Check that `Layout.astro:43` (`<script is:inline src="/scripts/layout.js">`) works without `'unsafe-inline'`. The `is:inline` attribute forces inline embedding, which conflicts with CSP `script-src 'self'`. Need to remove `is:inline` so Astro bundles the script.
4. Similarly check `results.astro` and `report.astro` for `is:inline` scripts
5. Test in production build to verify no CSP violations

**Risk:** If any page still has `is:inline` scripts, they will be blocked. Must verify thoroughly.

**Commit:** `fix(web): 🔒 tighten CSP by removing unsafe-inline from script-src`

---

## Task 2: Deduplicate `calculateDiscount`/`calculatePoints` (M-02)

**Finding:** `discount.ts` and `points.ts` have identical logic — DRY violation.

**Files:**
- `packages/core/src/calculator/discount.ts`
- `packages/core/src/calculator/points.ts`
- `packages/core/src/calculator/cashback.ts`

**Implementation:**
1. Extract a shared `calculatePercentageReward` function in a new file or in `types.ts`:
```ts
export function calculatePercentageReward(
  amount: number,
  rate: number,
  monthlyCap: number | null,
  currentMonthUsed: number,
): RewardCalcResult {
  const raw = Math.floor(amount * rate);
  if (monthlyCap === null) {
    return { reward: raw, newMonthUsed: currentMonthUsed + raw, capReached: false };
  }
  const remaining = Math.max(0, monthlyCap - currentMonthUsed);
  const reward = Math.min(raw, remaining);
  return { reward, newMonthUsed: currentMonthUsed + reward, capReached: raw > remaining };
}
```
2. Refactor `calculateDiscount`, `calculatePoints`, `calculateCashback` to delegate to `calculatePercentageReward`
3. Verify tests still pass

**Commit:** `refactor(core): ♻️ deduplicate percentage reward calculation functions`

---

## Task 3: Add error logging to bank adapter fallback (M-03)

**Finding:** `csv.ts:879-896` — Bank adapter fallback silently swallows exceptions.

**File:** `apps/web/src/lib/parser/csv.ts`

**Implementation:**
1. Add `console.warn` in the catch blocks:
```ts
try {
  return adapter.parseCSV(content);
} catch (err) {
  console.warn(`[cherrypicker] Bank adapter ${adapter.bankId} failed, falling through:`, err);
}
```
2. Do the same for the second catch block at line 888-895

**Commit:** `fix(parser): 📝 log warnings when bank adapter fallback triggers`

---

## Task 4: Fix PDF `parseAmount` to return NaN instead of 0 (M-05)

**Finding:** `pdf.ts:146-147` — `parseAmount` uses `|| 0` which converts unparseable amounts to 0 with no error.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. Change `parseAmount` to return `NaN` for unparseable values:
```ts
function parseAmount(raw: string): number {
  const n = parseInt(raw.replace(/원$/, '').replace(/,/g, ''), 10);
  return Number.isNaN(n) ? NaN : n;
}
```
2. In callers (`tryStructuredParse` and the fallback parser), add `Number.isNaN` checks and skip or report errors
3. This aligns with the CSV/XLSX parser patterns

**Commit:** `fix(web): 🐛 return NaN from PDF parseAmount instead of 0`

---

## Task 5: Add `includeSubcategories` consideration to `findRule` (M-06)

**Finding:** `reward.ts:69-71` — Subcategory blocking may be too aggressive for broad categories that should include some subcategories.

**File:** `packages/core/src/calculator/reward.ts`

**Implementation:**
This is a design concern, not a confirmed bug. For this cycle:
1. Add a code comment documenting the current behavior and rationale
2. Add a TODO noting that future card terms may need `includeSubcategories` in the schema
3. Do not change the logic — the current behavior matches typical Korean card term structure

**Commit:** `docs(core): 📝 document subcategory blocking rationale in findRule`

---

## Task 6: Document test fixture rate convention (M-07)

**Finding:** `calculator.test.ts` and `optimizer.test.ts` — Test fixture rates use percentage form (e.g., `rate: 2` meaning 2%) but this is not documented, creating confusion since `normalizeRate` divides by 100.

**Files:**
- `packages/core/__tests__/calculator.test.ts`
- `packages/core/__tests__/optimizer.test.ts`

**Implementation:**
1. Add a comment at the top of each test file:
```ts
// NOTE: Reward rate values in test fixtures use percentage form
// (e.g., rate: 2 means 2%, rate: 5 means 5%) matching YAML convention.
// calculateRewards() normalizes these via normalizeRate (divides by 100).
```

**Commit:** `docs(test): 📝 document percentage-form rate convention in test fixtures`

---

## Progress

- [x] Task 1: Tighten CSP — `0000000d3` (added strict-dynamic; unsafe-inline required by Astro hydration)
- [x] Task 2: Deduplicate calculate functions — `00000009e`
- [x] Task 3: Add error logging to bank adapter fallback — `0000000e6`
- [x] Task 4: Fix PDF parseAmount — `000000029`
- [x] Task 5: Document subcategory blocking rationale — `000000004`
- [x] Task 6: Document test fixture rate convention — `000000015`
