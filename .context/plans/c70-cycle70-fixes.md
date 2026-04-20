# Cycle 70 Implementation Plan

## Review Summary

Cycle 70 found 5 new findings (C70-01 through C70-05). The most impactful is C70-01 (MEDIUM): `detectBank` single-pattern banks can false-positive with 100% confidence. The others are LOW severity code quality/dedup issues.

All prior findings are carried forward. This cycle focuses on fixing C70-01 and C70-03 (actionable improvements to parser correctness), and C70-04 (code dedup).

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Cap confidence for single-pattern bank detection (C70-01)
**Priority:** HIGH (MEDIUM severity, HIGH confidence, real false-positive scenario)
**Files:** `apps/web/src/lib/parser/detect.ts:127-155`, `packages/parser/src/detect.ts:109-137`

**Problem:** Banks with only one generic pattern (e.g., `cu` with `/신협/`, `kdb` with `/산업은행/`) achieve 1.0 confidence on a single match. A statement mentioning "산업은행" in a transaction description would be detected as `kdb` with 100% confidence, even if the actual card is from another issuer.

**Concrete scenario:** A Shinhan card statement with a transaction at "KDB산업은행" would be misdetected as `kdb`, causing column mapping failures.

**Target code change:**
- When a bank has only 1 pattern match AND that bank has fewer than 2 total patterns, cap confidence at 0.5
- This ensures single-pattern banks are always treated as lower-confidence matches
- Banks with 2+ patterns achieving a score of 2+ retain full confidence

**Steps:**
1. In both `detectBank()` functions, add logic to reduce confidence for single-pattern banks
2. Add test case for false-positive scenario
3. Run `vitest` and `bun test` to verify no regressions
4. Commit

### Task 2: Add error indicator for unparseable dates (C70-03/C56-04)
**Priority:** MEDIUM (10 cycles agree; LOW severity but straightforward fix that improves error visibility)
**Files:** `apps/web/src/lib/parser/date-utils.ts:134`

**Problem:** `parseDateStringToISO` returns the raw input string when no date format matches. Downstream code stores this as the transaction date, which breaks date-based filtering (e.g., `tx.date.startsWith(latestMonth)`). There is no error indicator.

**Target code change:**
- Add a console.warn for unparseable date strings (matching the pattern used in `calculateRewards` for missing rate/fixedAmount)
- Keep returning the raw string as-is to preserve backward compatibility (changing the return type or value would break callers)
- The warning gives developers/users visibility that a date was not parsed correctly

**Steps:**
1. Add `console.warn` in `parseDateStringToISO` for the fallback return path
2. Run `vitest` and `bun test` to verify no regressions
3. Commit

### Task 3: Deduplicate csv.ts helpers by importing from shared.ts (C70-04)
**Priority:** LOW (code quality improvement, reduces maintenance burden)
**Files:** `apps/web/src/lib/parser/csv.ts:8-86`

**Problem:** The web CSV parser defines its own `splitLine()`, `parseAmount()`, `parseInstallments()`, and `isValidAmount()` that duplicate logic in `packages/parser/src/csv/shared.ts`. The shared module was extracted to eliminate this duplication but the web parser was not migrated.

**Note:** The web parser cannot directly import from `packages/parser/src/csv/shared.ts` because it runs in the browser while the shared module is designed for Bun. Instead, we should inline the improved versions of the shared helpers directly in csv.ts with a comment referencing shared.ts, and add the extra whitespace stripping to the shared module.

**Target code change:**
- Add `replace(/\s/g, '')` to `packages/parser/src/csv/shared.ts:parseCSVAmount` (the web parser does this but the shared module doesn't)
- Add a `isValidCSVAmount` type-guard function to `shared.ts` (matches the web csv.ts `isValidAmount`)
- Add a reference comment in `apps/web/src/lib/parser/csv.ts` pointing to shared.ts for the canonical implementation
- This is a partial dedup -- full dedup requires the D-01 architectural refactor

**Steps:**
1. Update `parseCSVAmount` in shared.ts to strip whitespace (matching web csv.ts)
2. Add `isValidCSVAmount` type guard to shared.ts
3. Add cross-reference comments in web csv.ts
4. Run `bun test` and `vitest` to verify no regressions
5. Commit

---

## Deferred Items (not scheduled for implementation this cycle)

| Finding | Reason for deferral |
|---|---|
| C70-02 (cachedCategoryLabels not invalidated on View Transitions) | Same class as C66-02. 14 cycles have flagged this. Categories.json is a static build artifact that cannot change during a session. The cache is already invalidated on reset(). Exit criterion: when categories.json can be updated at runtime. |
| C70-05 (BANK_SIGNATURES duplication between web and server) | Same class as C66-10/C7-07. 6 cycles agree. Both copies are currently identical. Full dedup requires D-01 architectural refactor (shared module between Bun and browser). Exit criterion: when the two copies drift out of sync. |
| C67-01 (greedy optimizer O(m*n*k)) | Same class as D-09/D-51/D-86. 12+ cycles deferred. Latency is acceptable for typical workloads. Exit criterion: when optimization latency exceeds 5s. |
| C66-02 (cachedCategoryLabels stale) | 14 cycles agree. Static build artifact -- cannot change at runtime. Exit criterion: when categories.json is updated during a user session. |
| C66-03 (MerchantMatcher O(n) substring) | 11 cycles agree. Pre-computed `SUBSTRING_SAFE_ENTRIES` already reduced overhead. Trie refactor is significant. Exit criterion: when merchant matching latency becomes noticeable. |
| C66-05 (FALLBACK_CATEGORIES hardcoded) | 6 cycles agree. Only used on network error. Exit criterion: when fallback is hit in production. |
| C66-08 (formatIssuerNameKo / CATEGORY_COLORS drift) | 6 cycles agree. Derived from YAML at build time. Exit criterion: when new issuers are added without updating maps. |
| C66-10 (BANK_SIGNATURES duplication) | 5 cycles agree. Same as C70-05. |
| C69-01 (animation flicker for tiny savings) | Informational only. Existing guard mitigates. |
| C56-05 (zero savings sign display) | Current "0원" display is correct. |
