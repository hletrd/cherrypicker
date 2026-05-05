# Cycle 16 Implementation Plan

## Source: `.context/reviews/_aggregate.md` (Cycle 16)

## Scheduled for Implementation

### 1. C16-01: Fix `isOptimizableTx` to allow negative amounts (MEDIUM) — COMPLETED
- **File:** `apps/web/src/lib/store.svelte.ts:209` → extracted to `apps/web/src/lib/tx-validation.ts`
- **Description:** `isOptimizableTx` requires `obj.amount > 0`, which silently drops refund transactions during sessionStorage restore.
- **Implementation:** Changed `obj.amount > 0` to `obj.amount !== 0`. Extracted function to `tx-validation.ts` for testability.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `f5fdcb2`

### 2. C16-02: Fix `reoptimize` monthlySpending to include refunds (LOW) — COMPLETED
- **File:** `apps/web/src/lib/store.svelte.ts:519`
- **Description:** `reoptimize` builds `monthlySpending` using `tx.amount > 0`, excluding refunds from previous-month spending calculation.
- **Implementation:** Changed `tx.amount > 0` to `tx.amount !== 0` and updated comment to clarify net spending convention.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `f5fdcb2`

### 3. C16-03: Remove redundant amount check in greedy optimizer (LOW) — COMPLETED
- **File:** `packages/core/src/optimizer/greedy.ts:54`
- **Description:** Redundant ternary since transactions are pre-filtered for positivity at line 198.
- **Implementation:** Replaced with `reward / transaction.amount` and added pre-filter guarantee comment.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `d8b3e52`

### 4. C16-TEST01: Add tests for `isOptimizableTx` (MEDIUM) — COMPLETED
- **File:** `apps/web/__tests__/tx-validation.test.ts` (new)
- **Description:** No unit tests existed for `isOptimizableTx`.
- **Implementation:** Added 11 tests covering positive, zero, negative amounts, NaN, Infinity, missing fields, and wrong types.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `b0eb6c4`

### 5. C16-DOC01: Fix `isOptimizableTx` comment (LOW) — COMPLETED
- **File:** `apps/web/src/lib/tx-validation.ts`
- **Description:** Comment did not mention negative amounts.
- **Implementation:** Updated comment to clarify that negative amounts (refunds/credits) are preserved.
- **Gates:** npm run lint, npm run typecheck — ALL PASS
- **Commit:** `f5fdcb2`

## Deferred

### C16-ARCH01: Parser duplication (MEDIUM)
- **File+line:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Original severity:** MEDIUM
- **Reason for deferral:** This is the same as D-01 (deferred since Cycle 1). Major architectural refactor requiring extraction of shared parser logic. The web app uses Astro which can import from packages/parser/ directly, but this requires build config changes and thorough testing.
- **Exit criterion:** Create a dedicated refactor cycle with a design doc first.

### C16-DB01: `loadFromStorage` shallow validation (MEDIUM)
- **File+line:** `apps/web/src/lib/store.svelte.ts:250-312`
- **Original severity:** MEDIUM
- **Reason for deferral:** Fixing this properly requires adding Zod schema validation for the full persisted shape, which is a non-trivial addition. The partial validation currently in place catches the most common corruption cases.
- **Exit criterion:** Add runtime schema validation for persisted data shape.

### C16-SEC01: `MIGRATIONS` uses `any` type (LOW)
- **File+line:** `apps/web/src/lib/store.svelte.ts:114`
- **Original severity:** LOW
- **Reason for deferral:** The MIGRATIONS object is currently empty (no migrations defined). The risk only materializes when migrations are added. Can be fixed when the first migration is implemented.
- **Exit criterion:** When adding the first migration function.

### C16-SEC02: HTML files accepted for upload (LOW)
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:97-106`
- **Original severity:** LOW
- **Reason for deferral:** Client-side parsing only, no server-side XSS risk. Social engineering risk is outside scope.
- **Exit criterion:** If user reports confusion from uploading non-bank HTML files.

### C16-SEC03: `findField` uses `in` operator (LOW)
- **File+line:** `apps/web/src/lib/parser/json.ts:58`
- **Original severity:** LOW
- **Reason for deferral:** Requires prototype pollution capability, which is not currently exposed. JSON.parse creates plain objects.
- **Exit criterion:** If prototype pollution attack surface is identified.

### C16-ARCH02: Hardcoded stale fallback values (LOW)
- **File+line:** `apps/web/src/lib/build-stats.ts:16-18`
- **Original severity:** LOW
- **Reason for deferral:** Cosmetic issue only. Build stats are displayed on the landing page and are not critical functionality.
- **Exit criterion:** Generate build-stats.ts from cards.json at build time.

### C16-ARCH03: `as AnalysisResult` cast (LOW)
- **File+line:** `apps/web/src/lib/store.svelte.ts:312`
- **Original severity:** LOW
- **Reason for deferral:** Same root cause as C16-DB01. Fixing both together with schema validation is more efficient.
- **Exit criterion:** Add Zod schema validation for persisted data.

### C16-TEST02: No sessionStorage round-trip tests (LOW)
- **File+line:** `apps/web/src/lib/store.svelte.ts:150-326`
- **Original severity:** LOW
- **Reason for deferral:** Testing sessionStorage requires mocking the Web Storage API. Non-trivial test setup.
- **Exit criterion:** When implementing comprehensive store testing.

### C16-TEST03: No reoptimize monthlySpending tests (LOW)
- **File+line:** `apps/web/src/lib/store.svelte.ts:510-523`
- **Original severity:** LOW
- **Reason for deferral:** The reoptimize function is tested indirectly through integration tests. Dedicated unit tests are nice-to-have.
- **Exit criterion:** When adding dedicated store unit tests.

### C16-PERF01: availableIssuers recomputes (LOW)
- **File+line:** `apps/web/src/components/cards/CardGrid.svelte:29-35`
- **Original severity:** LOW
- **Reason for deferral:** Negligible impact at current card count (~683). Only matters if card database grows 10x+.
- **Exit criterion:** If CardGrid becomes sluggish with larger datasets.

### C16-PERF02: reoptimize rebuilds monthly maps (LOW)
- **File+line:** `apps/web/src/lib/store.svelte.ts:510-530`
- **Original severity:** LOW
- **Reason for deferral:** O(n) per edit is acceptable for typical usage (< 1000 transactions).
- **Exit criterion:** If performance profiling shows reoptimize as a bottleneck.

### C16-UI01: No visual distinction for refunds (LOW)
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte`
- **Original severity:** LOW
- **Reason for deferral:** Only relevant after C16-01 is fixed. Can be implemented together or in a follow-up UI cycle.
- **Exit criterion:** After C16-01 is fixed.

### C16-UI02: Dismiss button lacks accessible name (LOW)
- **File+line:** `apps/web/src/components/dashboard/SpendingSummary.svelte:159`
- **Original severity:** LOW
- **Reason for deferral:** Minor accessibility gap. The button text "닫기" is adequate for Korean screen readers.
- **Exit criterion:** During a dedicated accessibility audit.

### C16-UI03: HTML accepted without bank structure check (LOW)
- **File:** `apps/web/src/components/upload/FileDropzone.svelte`
- **Original severity:** LOW
- **Reason for deferral:** Same as C16-SEC02. Client-side only, no security risk.
- **Exit criterion:** If user reports confusion from uploading non-bank HTML files.

### C16-DOC02: Comment mentions absolute value incorrectly (LOW)
- **File+line:** `apps/web/src/lib/parser/csv.ts:176-178`
- **Original severity:** LOW
- **Reason for deferral:** Comment is mostly correct; the absolute value mention is a minor inaccuracy.
- **Exit criterion:** Next parser-focused cycle.

## Carry-overs
- D-01 through D-09 and all prior deferred items remain unchanged.
- C14-03, C14-05, C14-DB03, C15-03 through C15-PERF02 remain deferred per existing policy.
