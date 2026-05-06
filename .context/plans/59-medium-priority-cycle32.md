# Plan 59 — Medium Priority Fixes (Cycle 32)

**Source findings:** C32-CRIT04 (global cap capReached), C32-V08 (AbortController reuse), C32-V09 (JSON findField order), C32-BUG-3 (NaN validation), C32-F7 (type assertions), C32-V12 (unstable sort), C32-INFRA01 (vitest config), C32-V10 (OFX laxness), C32-DOC (README stale claims), C32-DES (designer findings)
**Date:** 2026-05-06

---

## Task 1: Fix global cap rollback missing capReached flag [C32-CRIT04]

**Finding:** C32-CRIT04 — MEDIUM / High confidence
**File:** `packages/core/src/calculator/reward.ts:286-305`

### Problem

When a reward exceeds `globalCap`, the code rolls back `ruleMonthUsed` (lines 303-304) but never sets `bucket.capReached = true`. The `capReached` boolean only reflects rule-level cap hits (line 282). Users see `capReached: false` for categories clipped by the global cap, misleading them into thinking more spending would yield more rewards.

### Implementation

1. Open `packages/core/src/calculator/reward.ts`
2. Locate the global cap block (lines 287-305):
   ```typescript
   if (globalCap !== null) {
     // ... clip logic ...
     if (rewardAfterMonthlyCap > globalRemaining) {
       // ... capsHit push ...
       // ... rollback ...
     }
     globalMonthUsed += appliedReward;
   }
   ```
3. After the rollback (line 304) and before `globalMonthUsed += appliedReward`, add:
   ```typescript
   bucket.capReached = true;
   ```
4. Add test verifying that a global-cap-clipped reward sets `capReached: true`.

### Exit Criterion

- Global cap clip sets `capReached = true` on the bucket
- Rule-level cap clip still works correctly
- Tests verify both cases

---

## Task 2: Fix scraper fetcher AbortController reuse across two fetches [C32-V08]

**Finding:** C32-V08 — MEDIUM / High confidence
**File:** `tools/scraper/src/fetcher.ts:38-76`

### Problem

`fetchCardPage` creates one `AbortController` and uses it for the initial `fetch`. If EUC-KR is detected, it calls `fetch(url)` a second time with the SAME controller signal. If the first fetch's timeout fires between the two fetches, the second fetch is also aborted.

### Implementation

1. Open `tools/scraper/src/fetcher.ts`
2. Locate the EUC-KR re-fetch block
3. Create a fresh `AbortController` for the second fetch, or abort the first before starting the second
4. Option: create a new controller with the same timeout:
   ```typescript
   // Create fresh controller for the re-fetch (C32-V08)
   const controller2 = new AbortController();
   const timeout2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);
   const res2 = await fetch(url, { signal: controller2.signal, ... });
   clearTimeout(timeout2);
   ```

### Exit Criterion

- Second fetch uses independent abort signal
- First fetch timeout does not abort second fetch
- Existing scraper tests pass

---

## Task 3: Fix JSON findField non-deterministic Object.keys order [C32-V09]

**Finding:** C32-V09 — MEDIUM / High confidence
**Files:** `packages/parser/src/json/index.ts:195-216`, `apps/web/src/lib/parser/json.ts:195-216`

### Problem

`findField` iterates over `Object.keys(obj)` for case-insensitive matching. Per ECMAScript spec, `Object.keys` order depends on insertion order. Two JSON files with the same fields in different order may match different aliases, producing inconsistent parse results.

### Implementation

1. Open both JSON parser files (web and server)
2. In `findField`, iterate aliases in deterministic priority order instead of depending on `Object.keys` order:
   ```typescript
   // Try exact match first (fast path)
   for (const alias of aliases) {
     if (Object.hasOwn(obj, alias)) return { key: alias, value: obj[alias] };
   }
   // Then case-insensitive fallback — deterministic, not Object.keys dependent
   const lowerAliases = aliases.map(a => a.toLowerCase());
   for (const [k, v] of Object.entries(obj)) {
     const lowerK = k.toLowerCase();
     for (let i = 0; i < aliases.length; i++) {
       if (lowerK === lowerAliases[i]) return { key: aliases[i], value: v };
     }
   }
   ```
   Actually, the current code already does this. The issue is that the FIRST `Object.hasOwn(obj, alias)` check returns the FIRST alias that matches exactly. But if a JSON has both `date` and `transactionDate`, the match depends on alias array order (which is fixed), not Object.keys order.

   Re-reading the verifier evidence: "Two JSON files with the same fields in different order may match different aliases." The problem is that `findField` tries aliases in order, but the first `Object.hasOwn(obj, alias)` check only finds EXACT matches. If a JSON has `transactionDate` and `Date`, and the aliases are `['date', 'transactionDate']`, it matches `date` exactly. If the JSON has `transactionDate` but NOT `date`, the exact check fails, then case-insensitive fallback finds `transactionDate`. This IS deterministic.

   Wait, the verifier says the issue is that `Object.keys` order affects which alias matches in the case-insensitive fallback. Looking at the actual code more carefully... if the object has keys in insertion order, and the case-insensitive fallback iterates `Object.keys(obj)`, then for two objects with different key orders, the FIRST case-insensitive match wins. But aliases have a fixed order. Hmm.

   Actually, the issue is simpler: the current code does:
   ```typescript
   for (const alias of aliases) {
     if (Object.hasOwn(obj, alias)) return ...;  // exact
     for (const key of Object.keys(obj)) {
       if (key.toLowerCase() === alias.toLowerCase()) return ...;  // case-insensitive
     }
   }
   ```
   For the case-insensitive branch, if a JSON has both `transactionDate` and `date` (case variants), the outer loop tries `date` first (exact fails), then the inner loop iterates `Object.keys(obj)`. If `Object.keys` returns `['transactionDate', 'date']` (insertion order), then `transactionDate` matches `date` case-insensitively FIRST. But if `Object.keys` returns `['date', 'transactionDate']`, then `date` matches first.

   Wait, but `Object.keys` order for string keys IS insertion order. So if user A uploads `{transactionDate: '...', date: '...'}` vs user B uploads `{date: '...', transactionDate: '...'}`, they get different matches for the `date` alias. That's the bug.

   Fix: In the case-insensitive fallback, scan ALL aliases against ALL keys and pick the FIRST alias in alias order (not the first key in insertion order):
   ```typescript
   // Case-insensitive fallback: collect all matches, prefer alias order
   for (const key of Object.keys(obj)) {
     for (const alias of aliases) {
       if (key.toLowerCase() === alias.toLowerCase()) {
         return { key: alias, value: obj[key] };
       }
     }
   }
   ```
   This way, `aliases` order (which is fixed) determines priority, not `Object.keys` insertion order.

### Implementation (corrected)

1. Swap the nesting in the case-insensitive fallback: iterate `aliases` in the INNER loop, not outer.
2. This makes alias priority deterministic regardless of JSON key insertion order.

### Exit Criterion

- Two JSON files with same fields in different order produce identical parse results
- Alias order determines match priority, not insertion order
- Tests verify determinism with swapped key order

---

## Task 4: Add NaN validation to reoptimize previousMonthSpending [C32-BUG-3]

**Finding:** C32-BUG-3 — MEDIUM / High confidence
**File:** `apps/web/src/lib/store.svelte.ts:567-569`

### Problem

`reoptimize` accepts `options.previousMonthSpending` with only `!== undefined` check. `NaN` passes this check and propagates through the optimizer, causing all rewards to silently become 0.

### Implementation

1. Open `apps/web/src/lib/store.svelte.ts`
2. Locate lines 567-569:
   ```typescript
   if (options?.previousMonthSpending !== undefined) {
     previousMonthSpending = options.previousMonthSpending;
   }
   ```
3. Add `Number.isFinite` check:
   ```typescript
   if (options?.previousMonthSpending !== undefined && Number.isFinite(options.previousMonthSpending)) {
     previousMonthSpending = options.previousMonthSpending;
   }
   ```
4. Also add validation at the UI input level (wherever the form field sets this value).

### Exit Criterion

- `NaN` is rejected and falls back to computed previous month spending
- Valid numbers still pass through correctly
- Test verifies NaN rejection

---

## Task 5: Replace scattered type assertions with runtime guards [C32-F7]

**Finding:** C32-F7 — MEDIUM / High confidence
**Files:** `apps/web/src/lib/store.svelte.ts:223,267,287,328`, `apps/web/src/lib/tx-validation.ts:10`, `apps/web/src/lib/parser/json.ts:176,182,189,216`, `apps/web/src/lib/parser/pdf.ts:479`

### Problem

Twelve `as` casts bypass TypeScript structural checking. If external data changes shape, the casts produce `undefined` or garbage that propagates silently.

### Implementation

1. Create small validation helpers in `apps/web/src/lib/parser/types.ts` or a new `validation.ts`:
   ```typescript
   export function asArray<T>(value: unknown): T[] {
     if (!Array.isArray(value)) throw new ParseError(`Expected array, got ${typeof value}`);
     return value as T[];
   }
   export function asNumberArray(value: unknown): number[] {
     const arr = asArray<unknown>(value);
     if (!arr.every(v => typeof v === 'number' && Number.isFinite(v))) {
       throw new ParseError('Expected number array');
     }
     return arr as number[];
   }
   ```
2. Replace each `as` cast with the appropriate guard:
   - `store.svelte.ts:223` — `as Record<string, unknown>` → use `typeof obj === 'object' && obj !== null`
   - `json.ts:182` — `as unknown[]` → `asArray(obj[key])`
   - `pdf.ts:479` — `as number[]` → `asNumberArray(item.transform)`
3. Add tests for each guard rejecting invalid shapes.

### Exit Criterion

- No bare `as` casts remain on external data in the listed files
- Runtime guards throw ParseError on shape mismatch instead of propagating undefined
- All existing tests pass

---

## Task 6: Fix greedy optimizer unstable sort [C32-V12]

**Finding:** C32-V12 — LOW / Medium confidence
**File:** `packages/core/src/optimizer/greedy.ts:50-55`

### Problem

`transactions.sort((a, b) => b.amount - a.amount)` is unstable in V8. Equal-amount transactions may reorder non-deterministically across runs, producing inconsistent card recommendations.

### Implementation

1. Open `packages/core/src/optimizer/greedy.ts`
2. Add a secondary sort key for determinism:
   ```typescript
   transactions.sort((a, b) => {
     const amountDiff = b.amount - a.amount;
     if (amountDiff !== 0) return amountDiff;
     // Secondary: merchant name, then date for stable ordering
     const merchantDiff = a.merchant.localeCompare(b.merchant);
     if (merchantDiff !== 0) return merchantDiff;
     return a.date.localeCompare(b.date);
   });
   ```

### Exit Criterion

- Equal-amount transactions always sort in the same order
- Sort is deterministic across runs
- Tests verify stability

---

## Task 7: Add excluded test files to vitest.config.ts [C32-INFRA01]

**Finding:** C32-INFRA01 — MEDIUM / High confidence
**File:** `vitest.config.ts:30-36`

### Problem

`vitest.config.ts` only includes 9 test files out of 36+. The majority (web tests, parser tests, CLI tests, scraper tests) are excluded and only run via `bun test`. Developers running `npm test` get a false sense of security.

### Implementation

1. Open `vitest.config.ts`
2. Add the missing paths to the `include` array:
   ```typescript
   include: [
     'packages/core/__tests__/**/*.test.ts',
     'packages/parser/__tests__/**/*.test.ts',
     'packages/rules/__tests__/**/*.test.ts',
     'packages/viz/__tests__/**/*.test.ts',
     'apps/web/__tests__/**/*.test.ts',
     'tools/cli/__tests__/**/*.test.ts',
     'tools/scraper/__tests__/**/*.test.ts',
   ],
   ```
3. Verify that `vitest-bun-shim.ts` handles any Bun-specific imports in the newly included tests.
4. Run `npx vitest` to confirm all included tests pass under vitest.

### Exit Criterion

- `npx vitest` runs all test files (not just 9)
- No test failures under vitest
- `bun test` still passes

---

## Task 8: Document OFX amount normalization extended format acceptance [C32-V10]

**Finding:** C32-V10 — LOW / Medium confidence
**Files:** `packages/parser/src/ofx/index.ts:122-125`, `apps/web/src/lib/parser/ofx.ts:136-144`

### Problem

`parseOFXAmount` delegates to `parseAmountString`, which accepts full-width digits, Won signs, `KRW` prefix, `마이너스`, etc. OFX spec says amounts are plain decimal strings. The extra normalization masks data quality issues.

### Implementation

1. Add a comment in both OFX parser files documenting the behavior:
   ```typescript
   // NOTE(C32-V10): OFX amounts are normalized via parseAmountString, which
   // accepts extended Korean formats (full-width digits, ₩/원, KRW prefix,
   // 마이너스). This is intentionally permissive to handle bank-specific OFX
   // exports that may include non-standard formatting. Strict OFX-only parsing
   // would reject these but is not currently required.
   ```
2. No functional change — this is documentation-only.

### Exit Criterion

- Comment clearly documents why OFX parser accepts extended formats
- No functional change

---

## Task 9: Fix README stale claims [C32-DOC]

**Finding:** C32-DOC — LOW / High confidence
**File:** `README.md`

### Problem

- Line 82: Claims `TypeScript 6` — actual version is 5.9.x
- Lines 13, 79, 98: Claims `561개 카드` — actual count is 683 (per `build-stats.ts` and badges)
- Lines 34, 48, 78, 93: AI classification described as "preparing self-hosted runtime" — actually a permanently unimplemented stub

### Implementation

1. Open `README.md`
2. Change `TypeScript 6` to `TypeScript 5.9`
3. Change all `561개` references to `683+` or remove hardcoded counts and rely on badges
4. Update AI classification text to clearly state it is not on the current roadmap
5. Remove or update `categorizer-ai.ts` reference

### Exit Criterion

- README tech stack claims are factually accurate
- Card counts match actual data or are dynamic
- AI classification status is honest about current roadmap

---

## Task 10: Fix KB issuer badge contrast and rate bar height [C32-DES]

**Finding:** C32-DES — LOW / High confidence
**Files:** `apps/web/src/lib/formatters.ts:150-153`, `OptimalCardMap.svelte:125-129`, `FileDropzone.svelte:408-412`

### Problem

1. `getIssuerTextColor` only marks `kakao` and `jeju` as dark text. `kb` uses `#ffb800` (bright yellow) with white text — ~1.4:1 contrast, far below WCAG AA 4.5:1.
2. Rate bars use `h-1.5` (6px) — nearly invisible on mobile.
3. Step connector uses `h-px` (1px) — hairline on high-DPI.

### Implementation

1. Add `'kb'` to `darkTextIssuers` in `formatters.ts`
2. Change `h-1.5` to `h-2.5` or `h-3` in `OptimalCardMap.svelte`
3. Change `h-px` to `h-0.5` in `FileDropzone.svelte`

### Exit Criterion

- KB badge has dark text on yellow background
- Rate bars are visibly thicker
- Connector lines are 2px minimum

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | DONE — included in commit d8cfd3c (reward.ts) |
| 2 | DONE — commit e2b00df |
| 3 | DONE — commit ca30754 |
| 4 | DONE — commit 423a7df |
| 5 | DONE — commit c022239 |
| 6 | DONE — commit 419fb2b |
| 7 | DONE — commit 216cdd7 |
| 8 | DONE — commit 7ea2d36 |
| 9 | DONE — commit 453edce |
| 10 | DONE — commit 453edce |
