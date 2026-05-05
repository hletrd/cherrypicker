# Cycle 15 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, test-engineer, perf-reviewer, and architect.

Provenance files retained at `.context/reviews/c15-{agent-name}.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C15-01 — C14-02 incomplete: store.svelte.ts and build-stats.ts still have console.warn (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM)
- **Files:** `apps/web/src/lib/store.svelte.ts:191, 243, 246, 330, 338, 358`; `apps/web/src/lib/build-stats.ts:27, 31`
- **Consensus:** Commit `90da9c8` (C14-02) only removed console.warn from analyzer.ts. Eight console.warn calls remain across store.svelte.ts (6) and build-stats.ts (2). These leak internal data to production browsers. The UI already surfaces these conditions via error states, so console.warn is redundant.

### C15-02 — Both rate and fixedAmount: fixed reward silently dropped (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), architect (MEDIUM)
- **File:** `packages/core/src/calculator/reward.ts:261`
- **Consensus:** When a tier has both rate and fixedAmount, the rate branch takes precedence and fixed reward is silently ignored. The YAML schema should enforce mutual exclusion rather than relying on a runtime comment.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Code Quality | `apps/web/src/lib/store.svelte.ts:191,243,246,330,338,358` | C15-01: console.warn remains after partial C14-02 fix | code-reviewer, debugger |
| 2 | **MEDIUM** | Correctness | `packages/core/src/calculator/reward.ts:261` | C15-02: Both rate+fixedAmount — fixed silently dropped | code-reviewer, architect |
| 3 | **MEDIUM** | Performance | `packages/core/src/optimizer/greedy.ts:56` | C15-PERF01: push/pop mutation pattern is fragile | perf-reviewer |
| 4 | **LOW** | Code Quality | `apps/web/src/lib/build-stats.ts:27, 31` | C15-05: Additional console.warn not tracked before | code-reviewer |
| 5 | **LOW** | Correctness | `packages/parser/src/csv/shared.ts:160` | C15-03: parseFloat accepts scientific notation | code-reviewer |
| 6 | **LOW** | Correctness | `packages/parser/src/csv/adapter-factory.ts:163` | C15-04: Quote stripping only handles one layer | code-reviewer |
| 7 | **LOW** | Security | `packages/parser/src/ofx/index.ts:59` | C15-SEC01: Dynamic RegExp with hardcoded tag names | security-reviewer |
| 8 | **LOW** | Security | `apps/web/src/components/upload/FileDropzone.svelte:97` | C15-SEC02: HTML files accepted for upload | security-reviewer |
| 9 | **LOW** | Testing | `packages/core/__tests__/calculator.test.ts` | C15-TEST01: No test for rate+fixedAmount branch | test-engineer |
| 10 | **LOW** | Testing | `packages/parser/__tests__/csv-shared.test.ts` | C15-TEST02: No test for scientific notation | test-engineer |
| 11 | **LOW** | Testing | `packages/parser/__tests__/csv-adapters.test.ts` | C15-TEST03: No test for merchant quote escaping | test-engineer |
| 12 | **LOW** | Performance | `apps/web/src/lib/store.svelte.ts:531` | C15-PERF02: Monthly map rebuild on every reoptimize | perf-reviewer |

---

## Carry-overs from Previous Cycles

### MEDIUM-priority carry-overs
- **D-01** — Parser duplication (web vs packages). HIGH. Major refactor deferred.
- **D7-M13** — CSP `unsafe-inline` in script-src. MEDIUM.
- **C14-03** — renderPageText hardcoded char width. MEDIUM, deferred.
- **C14-05** — parseDateStringToISO fullMatch lacks end anchor. MEDIUM, deferred.
- **C14-DB03** — Fallback values bypass type safety. MEDIUM, deferred.

### LOW-priority carry-overs
- D-09, D-36, D-37, C14-TEST-02, and other prior deferred items.

---

## Agent Failures

None. All review perspectives completed successfully.

---

## Recommended Priority Order

1. **C15-01** — Remove remaining console.warn from store.svelte.ts and build-stats.ts (MEDIUM)
2. **C15-02** — Add Zod validation for rate+fixedAmount mutual exclusion (MEDIUM)
3. **C15-PERF01** — Replace push/pop mutation with spread in greedy optimizer (MEDIUM)
4. **C15-03** — Guard parseAmountString against scientific notation (LOW)
5. **C15-04** — Fix adapter-factory quote stripping (LOW)
6. **C15-05** — Remove console.warn from build-stats.ts (LOW)
7. **C15-SEC01** — Add tagName validation in OFX extractTag (LOW)
8. **C15-TEST01-03** — Add tests for uncovered branches (LOW)

**Overall Verdict:** Cycle 15 has 3 MEDIUM and 9 LOW actionable findings. Priority should go to C15-01 (completing the C14-02 cleanup) and C15-02 (preventing silent data loss in reward calculation).
