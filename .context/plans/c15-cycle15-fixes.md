# Cycle 15 Implementation Plan

## Source: `.context/reviews/_aggregate.md` (Cycle 15)

## Scheduled for Implementation

### 1. C15-01: Remove remaining console.warn calls (MEDIUM) — COMPLETED
- **Files:** `apps/web/src/lib/store.svelte.ts:191, 243, 246, 330, 338, 358`; `apps/web/src/lib/build-stats.ts:27, 31`
- **Description:** C14-02 commit only fixed analyzer.ts. Eight console.warn calls remain.
- **Implementation:** Remove all console.warn calls. The UI already surfaces persistence errors via error states and persistWarningKind. For build-stats.ts, convert to silent fallback behavior.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `866da1a`

### 2. C15-02: Add Zod validation for rate+fixedAmount mutual exclusion (MEDIUM) — COMPLETED
- **File:** `packages/rules/src/schema.ts`
- **Description:** When a tier has both rate and fixedAmount, reward.ts silently drops the fixed reward. The YAML schema should enforce mutual exclusion.
- **Implementation:** Schema already had the `.refine()` (added in a prior cycle). Added 3 tests to `packages/rules/__tests__/schema.test.ts`: rejects both rate>0 and fixedAmount>0, allows rate=0 + fixedAmount>0, allows rate>0 + fixedAmount=0.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `fc2bfb5`

### 3. C15-PERF01: Replace push/pop mutation with spread in greedy optimizer (MEDIUM) — COMPLETED
- **File:** `packages/core/src/optimizer/greedy.ts:56-58`
- **Description:** The push/pop mutation pattern is fragile — relies on calculateCardOutput not modifying the array.
- **Implementation:** Replaced push/pop with `calculateCardOutput([...currentTransactions, transaction], ...)` and removed the associated comment block.
- **Gates:** npm run lint, npm run typecheck, bun run test — ALL PASS
- **Commit:** `c425344`

## Deferred

### C15-03: parseAmountString scientific notation guard (LOW)
- **Reason:** Edge case with very low probability in real bank data. Can be included in next parser-focused cycle.
- **Exit criterion:** Next cycle with parser additions.

### C15-04: adapter-factory quote stripping (LOW)
- **Reason:** Korean bank exports rarely use escaped quotes in merchant names. RFC 4180 doubled-quote handling is a nice-to-have.
- **Exit criterion:** If a real-world statement with escaped merchant quotes is encountered.

### C15-05: build-stats.ts console.warn (LOW)
- **Reason:** Already covered by C15-01 plan. Will be fixed together.
- **Exit criterion:** C15-01 implementation.

### C15-SEC01: OFX tagName validation (LOW)
- **Reason:** Tag names are hardcoded, not attacker-controlled. Theoretical concern only.
- **Exit criterion:** If extractTag is ever called with user-derived tag names.

### C15-SEC02: HTML file upload acceptance (LOW)
- **Reason:** Client-side parsing only, no server-side XSS risk. Social engineering risk is outside scope.
- **Exit criterion:** If user reports confusion from uploading HTML files.

### C15-TEST01-03: Test coverage gaps (LOW)
- **Reason:** Test additions are best-effort. Main functionality is well-covered.
- **Exit criterion:** Next dedicated test-focused cycle.

### C15-PERF02: Monthly map rebuild (LOW)
- **Reason:** O(n) rebuild is acceptable for typical usage (< 1000 transactions). Only affects large statement sets.
- **Exit criterion:** If performance profiling shows reoptimize as a bottleneck for large datasets.

### Carry-overs
- D-01 through D-37 and C14-03, C14-05, C14-DB03 remain deferred per existing policy.
