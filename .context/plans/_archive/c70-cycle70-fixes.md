# Cycle 70 Implementation Plan

## Review Summary

Cycle 70 found 5 new findings (C70-01 through C70-05). The most impactful is C70-01 (MEDIUM): `detectBank` single-pattern banks can false-positive with 100% confidence. The others are LOW severity code quality/dedup issues.

All prior findings are carried forward. This cycle focuses on fixing C70-01 and C70-03 (actionable improvements to parser correctness), and C70-04 (code dedup).

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Cap confidence for single-pattern bank detection (C70-01) -- DONE
**Priority:** HIGH (MEDIUM severity, HIGH confidence, real false-positive scenario)
**Files:** `apps/web/src/lib/parser/detect.ts`, `packages/parser/src/detect.ts`
**Commit:** `f417fd3` fix(parser): cap confidence for single-pattern bank detection

Implemented: Added confidence cap at 0.5 when a bank has fewer than 2 total patterns and the match score is less than 2. Applied to both web and server-side `detectBank()` functions.

### Task 2: Add console.warn for unparseable dates (C70-03/C56-04) -- DONE
**Priority:** MEDIUM (10 cycles agree; LOW severity but straightforward fix that improves error visibility)
**Files:** `apps/web/src/lib/parser/date-utils.ts`
**Commit:** `0000000221` fix(parser): warn on unparseable date strings in parseDateStringToISO

Implemented: Added `console.warn` at the fallback return path of `parseDateStringToISO()` so developers/users can identify dates that were not parsed correctly. Raw string still returned for backward compatibility.

### Task 3: Deduplicate csv.ts helpers (C70-04) -- DONE
**Priority:** LOW (code quality improvement, reduces maintenance burden)
**Files:** `packages/parser/src/csv/shared.ts`, `apps/web/src/lib/parser/csv.ts`
**Commit:** `00000000c7` (bundled with docs commit)

Implemented: Added `replace(/\s/g, '')` to `parseCSVAmount` in shared.ts to strip internal whitespace (matching web csv.ts behavior). Added `isValidCSVAmount` type guard function to shared.ts. Added cross-reference comments in web csv.ts pointing to shared.ts as canonical implementation.

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
