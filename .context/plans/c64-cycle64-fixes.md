# Cycle 64 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle64-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### Task 1: C64-01 (MEDIUM, HIGH): Update test file to use production `parseDateStringToISO` and add `isValidDayForMonth` coverage

**File:** `apps/web/__tests__/parser-date.test.ts:27-98`
**Problem:** The test file duplicates the PRE-C63-04 date parsing logic. Its local `parseDateToISO` function uses `day >= 1 && day <= 31` validation, while production `date-utils.ts` now uses `isValidDayForMonth(year, month, day)`. This means:
1. The test is NOT testing actual production behavior
2. Feb 31 would pass the test's local validation but be rejected by production code
3. The `isValidDayForMonth`/`daysInMonth` functions added in C63-04 have zero test coverage

**Fix:**
1. Update the test to import `parseDateStringToISO` directly from `date-utils.ts` instead of reproducing the logic locally
2. Add test cases for `isValidDayForMonth`:
   - Feb 29 in a leap year (2024) passes
   - Feb 29 in a non-leap year (2025) is rejected
   - Feb 31 is rejected in all years
   - Apr 31 is rejected
   - Month-specific boundary tests (Jan 31 passes, Jun 31 rejected)
3. Remove the duplicated `parseDateToISO` and `inferYear` functions from the test file
4. Update existing tests that relied on the old `day <= 31` behavior (e.g., tests that used day=31 for months with fewer days)

**Steps:**
1. [x] Update test file to import `parseDateStringToISO` and `inferYear` from `date-utils.ts`
2. [x] Remove duplicated `parseDateToISO` and `inferYear` from test file
3. [x] Add `isValidDayForMonth` test cases for month-specific day limits
4. [x] Update any existing tests that are now incorrect due to stricter validation
5. [x] Run all gates to confirm no regressions (68 pass, 0 fail)
6. [x] Commit with message: `test(parser): 🧪 update date tests to use production parseDateStringToISO and add month-aware day validation coverage` (00000008)

---

### Task 2: C64-02 (LOW, HIGH): Remove redundant EUC-KR from encoding candidates

**File:** `apps/web/src/lib/parser/index.ts:20`
**Problem:** EUC-KR in the encoding candidate list is redundant because CP949 is a strict superset of EUC-KR. CP949 will always produce equal or fewer replacement characters than EUC-KR, so EUC-KR can never win the "fewest replacement characters" heuristic. The EUC-KR entry adds an unnecessary TextDecoder decode + regex scan on every CSV parse.

**Fix:** Remove `'euc-kr'` from the `ENCODINGS` array, keeping only `['utf-8', 'cp949']`. Add a comment explaining that CP949 supersedes EUC-KR.

**Steps:**
1. [x] Remove `'euc-kr'` from `ENCODINGS` constant in `parser/index.ts`
2. [x] Add comment explaining CP949 supersedes EUC-KR
3. [x] Run all gates to confirm no regressions (6 encoding tests pass, 68 date tests pass)
4. [x] Commit with message: `perf(parser): ⚡ remove redundant EUC-KR encoding candidate (CP949 is a strict superset)` (00000006)

---

### Task 3: C64-03 (LOW, MEDIUM): Add TODO comment for CATEGORY_NAMES_KO drift risk

**File:** `packages/core/src/optimizer/greedy.ts:7-82`
**Problem:** `CATEGORY_NAMES_KO` is a hardcoded 75-entry map that can silently drift from the YAML taxonomy. Currently both sources agree, but a taxonomy update without updating this map would produce incorrect Korean labels in CLI output.

**Fix:** This is a low-severity finding. Rather than a full refactor (which would require the core package to depend on the rules package's YAML data at runtime), add a clear TODO comment documenting the drift risk and the correct remediation path (import labels from the rules package when running in CLI mode).

**Steps:**
1. [x] Add TODO comment above `CATEGORY_NAMES_KO` documenting the drift risk
2. [x] Commit with message: `docs(optimizer): 📝 add TODO for CATEGORY_NAMES_KO drift risk from YAML taxonomy` (00000003)

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C64-01/Convergence | MEDIUM/HIGH | HIGH | cachedCategoryLabels stale across redeployments. Already deferred across 8 cycles. Cache is invalidated on explicit `reset()`. Staleness across deployments is a theoretical concern. |
| C33-01/C62-01 | MEDIUM | HIGH | MerchantMatcher/taxonomy O(n) scan. Already deferred as D-100. Building a trie-based prefix index is disproportionate to the current scale. |
| C18-03/C62-03/C63-05 | LOW | MEDIUM | Annual savings simple *12 projection. Already deferred as D-40/D-82. The "약" label is adequate. |
| C63-06 | LOW | LOW | `getIssuerFromCardId` splits on `-` prefix assumption. Latent risk only -- all current card IDs follow the `{issuer}-{name}` pattern. |
| C56-04 | LOW | HIGH | date-utils.ts returns raw input for unparseable dates. Already deferred across 4 cycles. Passthrough is pragmatic -- the alternative (throwing) would crash the entire parse. |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.
