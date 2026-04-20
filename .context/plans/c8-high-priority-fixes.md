# Cycle 8 — High Priority Fixes

## Status: COMPLETED

---

### Plan 1: Make CardDetail $effect fetch abortable on unmount (C8-02) -- DONE

**Finding:** C8-02 — MEDIUM/High
**File:** `apps/web/src/components/cards/CardDetail.svelte:77-92`

The `$effect` at line 77 calls `getCardDetail(cardId)` via `.then()/.catch()/.finally()` with only a `fetchGeneration` counter to guard against stale results. No cleanup function is returned, so in-flight fetches are never cancelled on unmount or cardId change.

**Implementation:**
1. Check if `getCardDetail` in `api.ts` accepts an AbortSignal parameter. If not, add one.
2. In CardDetail's `$effect`, create an `AbortController` and pass its signal to `getCardDetail`.
3. Return a cleanup function that calls `controller.abort()`.
4. Guard all `.then()/.catch()/.finally()` callbacks with `!controller.signal.aborted` checks.

**Exit criterion:** CardDetail's $effect returns a cleanup function that aborts in-flight fetches.

---

### Plan 2: Remove or gate dead AI categorization code in TransactionReview (C8-01) -- DONE

**Finding:** C8-01 — MEDIUM/High
**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:6,49,77-143,262`

The `categorizer-ai.ts` module is entirely disabled (`isAvailable()` returns `false`, all functions throw). Yet TransactionReview still imports it, checks `isAvailable()`, and contains 65+ lines of unreachable `runAICategorization()` code.

**Implementation:**
1. Add a prominent comment block at the top of the `runAICategorization` function explaining the AI categorizer is disabled.
2. Add a comment at the import line explaining the disabled state.
3. Consider wrapping the AI-related code in a conditional compilation block or feature flag constant.
4. Do NOT remove the code entirely since it will be re-enabled when the self-hosted runtime is ready.

**Exit criterion:** Dead AI categorization code is clearly documented as disabled with comments explaining the status and what's needed to re-enable.

---

### Plan 3: Refactor persistToStorage to return warning kind (C8-12 / C7-05) -- DONE

**Finding:** C8-12 / C7-05 — LOW/High
**File:** `apps/web/src/lib/store.svelte.ts:106,157`

`_persistWarningKind` and `_loadPersistWarningKind` are module-level mutable variables creating implicit coupling. `persistToStorage` sets `_persistWarningKind`, and `setResult`/`analyze`/`reoptimize` read it.

**Implementation:**
1. Change `persistToStorage` return type from `void` to `PersistWarningKind`.
2. Return the warning kind directly from `persistToStorage` instead of setting `_persistWarningKind`.
3. Update `setResult`, `analyze`, and `reoptimize` to use the return value: `persistWarningKind = persistToStorage(result)`.
4. Remove the `_persistWarningKind` module-level variable.
5. Keep `_loadPersistWarningKind` for now since `loadFromStorage` is called during initialization (before the store exists), but add a TODO comment.

**Exit criterion:** `persistToStorage` returns `PersistWarningKind` directly; `_persistWarningKind` removed.

---

### Plan 4: Fix SpendingSummary month diff for year boundaries (C8-03) -- DONE

**Finding:** C8-03 — LOW/High
**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:119-121`

Month diff calculation uses `parseInt(month.slice(5, 7))` and `Math.abs(m1 - m2) <= 1`, which breaks for December -> January year boundaries (12 - 1 = 11, not 1).

**Implementation:**
1. Replace the month-number extraction and diff calculation with a proper date-based comparison.
2. Parse both `prevMonth.month` and `latestMonth.month` as dates.
3. Compute consecutive months via: `(nextYear - prevYear) * 12 + (nextMonth - prevMonth) === 1`.
4. Use the result to choose between "전월실적" and "이전 달 실적".

**Exit criterion:** Dec->Jan transition correctly labeled as "전월실적" (consecutive months).

---

## Deferred Findings

| Finding | Severity/Confidence | Reason for deferral | Exit criterion |
|---|---|---|---|
| C8-05 | LOW/High | Extends C4-09 (hardcoded colors) — requires design system changes | Design tokens for dark mode category colors |
| C8-06 | LOW/High | Extends C7-12 — requires Astro navigate() migration for all components | All navigation uses client-side routing |
| C8-07 | LOW/High | Extends C4-14 — stale fallback values in build-stats | Build script auto-generates fallbacks from YAML |
| C8-08 | LOW/Medium | Timezone edge case affects < 1 min/year — extremely unlikely | Use UTC dates in inferYear() |
| C8-09 | LOW/High | Test quality issue — requires extracting adapter to separate module | Adapter extracted to importable module |
| C8-10 | LOW/High | Implicit NaN filter works but is fragile | Add explicit NaN guard to installment parsing |
| C8-11 | LOW/Medium | Fallback date regex false positive on decimals | Add negative lookbehind for digits |
| C7-04 | LOW/Medium | TransactionReview $effect fragile but works correctly | Add generation change guard |
| C7-06 | LOW/High | Multi-month transaction behavior is by design | Document or filter editedTxs in reoptimize |
| C7-07 | LOW/High | BANK_SIGNATURES duplication covered by D-01 | Extract to shared module |
| C7-10 | LOW/High | CategoryBreakdown rounding artifact | Apply rounding adjustment |
| C7-11 | LOW/Medium | persistWarning already differentiated by kind | Improve message text |
| C7-13 | LOW/Medium | Cache uses null check now, works for current use case | Content-based cache key |
