# Plan 19 — Medium-Priority Fixes (Cycle 10)

**Priority:** MEDIUM
**Findings addressed:** C10-12, C10-01, C10-03, C10-13
**Status:** PENDING

---

## Task 1: Add `Number.isFinite` guard in XLSX `parseDateToISO` for numeric input (C10-03)

**Finding:** `apps/web/src/lib/parser/xlsx.ts:193-203` — `parseDateToISO` handles `typeof raw === 'number'` but doesn't guard against `Infinity` or `NaN` values from Excel formula errors. `NaN` is caught by the `raw < 1 || raw > 100000` check (since NaN comparisons are false), but `Infinity > 100000` is true, so `Infinity` would be passed to `XLSX.SSF.parse_date_code(Infinity)`.

**File:** `apps/web/src/lib/parser/xlsx.ts`

**Implementation:**
1. Add `Number.isFinite` check before the range check:
```ts
if (typeof raw === 'number') {
  // Guard against NaN and Infinity from Excel formula errors
  if (!Number.isFinite(raw) || raw < 1 || raw > 100000) return String(raw);
  // ... rest of serial date handling
}
```

**Commit:** `fix(parser): 🛡️ guard against Infinity/NaN in XLSX date parsing`

---

## Task 2: Add documentation comment for global cap over-count correction in `calculateRewards` (C10-01)

**Finding:** `packages/core/src/calculator/reward.ts:265-268` — When a reward exceeds the global cap, the code adjusts `ruleMonthUsed` downward by the overcount. This logic is correct but subtle and easy to misunderstand during maintenance.

**File:** `packages/core/src/calculator/reward.ts`

**Implementation:**
1. Add a documentation comment at lines 264-269:
```ts
// When the global cap clips a reward, the rule-level tracker was advanced
// by the full pre-clip amount (rewardAfterMonthlyCap). We must roll it back
// to reflect only what was actually applied, so subsequent transactions see
// the correct remaining rule-level cap relative to the global constraint.
const overcount = rewardAfterMonthlyCap - appliedReward;
ruleMonthUsed.set(rewardKey, ruleResult.newMonthUsed - overcount);
```

**Commit:** `docs(core): 📝 document global cap over-count correction in calculateRewards`

---

## Task 3: Add empty merchant name guard in `MerchantMatcher.match` (C10-13)

**Finding:** `packages/core/src/categorizer/matcher.ts:32-79` — An empty merchant name (`""`) matches the first keyword with 0.8 confidence because `kw.includes("")` is true for all strings. This is partially addressed by Task 3 in Plan 18 (which adds `lower.length < 2` guard), but that guard returns uncategorized for ALL short names. The empty-string case is specifically problematic and should be handled explicitly.

**File:** `packages/core/src/categorizer/matcher.ts`

**Implementation:**
1. This is already covered by the `lower.length < 2` guard in Plan 18 Task 3. If that guard is implemented, empty strings (`lower.length === 0`) and single-character names are both handled. No additional code needed — this task is a no-op if Plan 18 Task 3 is implemented.

**Commit:** (no separate commit needed — covered by Plan 18 Task 3)

---

## Progress

- [ ] Task 1: Guard against Infinity/NaN in XLSX date parsing
- [ ] Task 2: Document global cap over-count correction
- [ ] Task 3: (Covered by Plan 18 Task 3)
