# Cycle 69 Implementation Plan

## Review Summary

Cycle 69 found 2 new LOW-severity findings. C69-01 is informational (sub-second animation artifact). C69-02 was verified as already fixed (server-side `parseCSVAmount` in `shared.ts` already handles parenthesized negatives at line 36-37).

All prior findings are carried forward. This cycle focuses on addressing the most impactful long-standing deferred items.

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Improve `persistToStorage` error discrimination (C66-04/C62-11)
**Priority:** HIGH (8 cycles agree; low severity but easy fix that improves diagnostics)
**Files:** `apps/web/src/lib/store.svelte.ts:125-168`
**Status:** PENDING

**Problem:** `persistToStorage()` returns `{ kind: 'corrupted' }` for ALL non-quota errors, including `TypeError` (circular references), `SyntaxError` (unlikely from stringify), and other unexpected errors. This lumps data corruption together with code bugs, making it harder to diagnose persistence failures. The user sees "거래 내역을 불러오지 못했어요" for all failure types.

**Target code change:**
- Add a new `PersistWarningKind` value: `'error'` for unexpected non-quota persistence failures
- Return `{ kind: 'error' }` for non-quota errors instead of `{ kind: 'corrupted' }`
- Update the `PersistWarningKind` type and the `persistWarningKind` state
- Add a new user-facing message for `'error'` vs `'corrupted'`

**Steps:**
1. [ ] Update `PersistWarningKind` type to include `'error'`
2. [ ] In `persistToStorage`, return `{ kind: 'error' }` for non-quota catch path
3. [ ] Add user-facing message for `'error'` kind in the template section
4. [ ] Run `vitest` and `bun test` to verify no regressions
5. [ ] Commit: `fix(web): 🐛 distinguish persistence error types in store`

### Task 2: Add zero-savings plus-sign display fix (C56-05)
**Priority:** MEDIUM (9 cycles have flagged annual savings projection; this is the simplest sub-fix)
**Files:** `apps/web/src/components/dashboard/SavingsComparison.svelte:217`
**Status:** PENDING

**Problem:** When `savingsVsSingleCard` is exactly 0, the display shows "0원" without any sign prefix. The issue notes that zero savings should show a clear indicator. However, looking at the code more carefully, the actual finding is about the annual projection label being a simple `* 12` which doesn't account for varying monthly spending. The "0원 without plus sign" is a sub-issue of the broader annual projection problem.

For this cycle, focus on the narrower fix: when savings is exactly 0, show "0원" (no sign) which is already correct. The deeper annual projection issue remains deferred.

**Decision**: After re-examination, the current "0원" display for zero savings is actually correct (no + or - prefix needed for zero). The real C56-05 finding is about the `+` prefix not appearing for small positive savings, which the `Math.abs(displayedSavings) >= 1` guard already handles correctly. **Deferring** -- no code change needed.

### Task 3: Add fallback line scanner to server-side PDF parser (C34-04)
**Priority:** MEDIUM (server-side PDF has no fallback when structured parse fails, unlike web-side)
**Files:** `packages/parser/src/pdf/index.ts`
**Status:** PENDING

**Problem:** The server-side PDF parser (`packages/parser/src/pdf/index.ts`) has only two tiers: structured parse and LLM fallback. The web-side parser has three tiers: structured parse, fallback line scanner, and "no transactions found" error. When structured parse fails on the server and LLM is disabled (the default), the user gets an error message but no transactions. The web-side parser has a better chance of extracting transactions via its fallback line scanner.

**Target code change:**
- Port the fallback line scanner from `apps/web/src/lib/parser/pdf.ts:342-386` to the server-side parser
- Insert it between the structured parse and the LLM fallback tiers
- Use the same `DATE_PATTERN`, `AMOUNT_PATTERN`, and `parseDateStringToISO()` / `parseAmount()` helpers already available

**Steps:**
1. [ ] Add fallback line scanner after structured parse failure in `packages/parser/src/pdf/index.ts`
2. [ ] Reuse existing `parseDateStringToISO()` and `parseAmount()` helpers
3. [ ] Run `bun test` to verify no regressions
4. [ ] Commit: `feat(parser): ✨ add fallback line scanner to server-side PDF parser`

---

## Deferred Items (not scheduled for implementation this cycle)

| Finding | Reason for deferral |
|---|---|
| C67-01 (greedy optimizer O(m*n*k)) | Same class as D-09/D-51/D-86. 12+ cycles deferred. With 683 cards and <1000 transactions, latency is acceptable. Exit criterion: when optimization latency exceeds 5s or card count exceeds 5000. |
| C67-02 (inferYear timezone-dependent) | Same class as C8-08/D-49. 60+ cycles deferred. Narrow edge case (minutes around midnight, once per year). Exit criterion: when tests become flaky due to date-dependent parsing. |
| C67-03 (CATEGORY_NAMES_KO hardcoded) | Same class as C64-03. TODO comment already acknowledges. CLI path only; web path uses live taxonomy. Exit criterion: when new categories are added without updating the map. |
| C66-02 (cachedCategoryLabels stale) | 13 cycles agree. Would require invalidation mechanism across deployments. Complex change with unclear benefit for a static JSON data source that doesn't change at runtime. Exit criterion: when categories.json is updated during a user session (currently impossible since it's a static build artifact). |
| C66-03 (MerchantMatcher O(n) substring) | 11 cycles agree. The pre-computed `SUBSTRING_SAFE_ENTRIES` already eliminated the per-call `Object.entries()` overhead. A trie-based approach would be the correct fix but is a significant refactor. Exit criterion: when merchant matching latency becomes noticeable with >1000 transactions. |
| C66-05 (FALLBACK_CATEGORIES hardcoded) | 6 cycles agree. Only used when `loadCategories()` fails (network error). Exit criterion: when fallback is hit in production and the 13-category list causes user-visible mis-categorization. |
| C66-08 (formatIssuerNameKo / CATEGORY_COLORS drift) | 6 cycles agree. Both maps are derived from YAML data at build time. Exit criterion: when new issuers are added without updating the maps. |
| C66-10 (BANK_SIGNATURES duplication) | 5 cycles agree. Both copies are currently identical. Fix would require shared module between Bun and browser environments. Exit criterion: when the two copies drift out of sync. |
| C69-01 (animation flicker for tiny savings) | Informational only. The existing `Math.abs(displayedSavings) >= 1` guard already mitigates. Sub-second visual artifact with no user impact. |
| C69-02 (server-side CSV negative amounts) | **Already fixed** -- `packages/parser/src/csv/shared.ts:parseCSVAmount` line 36-37 handles parenthesized negatives. |
| C56-05 (zero savings sign display) | Current "0원" display is correct for zero savings. No code change needed. |
