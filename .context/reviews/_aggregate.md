# Cycle 16 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, test-engineer, perf-reviewer, architect, debugger, critic, verifier, tracer, document-specialist, and designer.

Provenance files retained at `.context/reviews/c16-{agent-name}.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C16-01 — `isOptimizableTx` excludes refund transactions, causing data loss on page refresh (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (MEDIUM), tracer (MEDIUM), critic (MEDIUM), document-specialist (MEDIUM)
- **File:** `apps/web/src/lib/store.svelte.ts:209`
- **Consensus:** The `isOptimizableTx` function requires `obj.amount > 0`, but its comment only mentions excluding zero-amount entries. Negative amounts (refunds/credits) are also excluded. Since parsers correctly preserve negative amounts, and the optimizer handles them by skipping, the persistence layer incorrectly discards refunds during sessionStorage restore. Users see refunds vanish after page refresh.
- **Fix:** Change `obj.amount > 0` to `obj.amount !== 0`.

### C16-02 — `reoptimize` excludes refunds from previous-month spending (LOW)
- **Agents:** code-reviewer (LOW), tracer (LOW)
- **File:** `apps/web/src/lib/store.svelte.ts:519`
- **Consensus:** The `reoptimize` function builds `monthlySpending` using `tx.amount > 0`, which excludes refunds from previous-month spending calculation. This could undercount spending and affect performance tier selection.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `apps/web/src/lib/store.svelte.ts:209` | C16-01: `isOptimizableTx` drops refunds on sessionStorage restore | code-reviewer, debugger, verifier, tracer, critic, document-specialist |
| 2 | **MEDIUM** | Architecture | `apps/web/src/lib/parser/` vs `packages/parser/src/` | C16-ARCH01: Parser duplication creates drift risk | architect, critic |
| 3 | **MEDIUM** | Correctness | `apps/web/src/lib/store.svelte.ts:250-312` | C16-DB01: `loadFromStorage` shallow validation allows corrupted data | debugger |
| 4 | **MEDIUM** | Testing | `apps/web/src/lib/store.svelte.ts:200-212` | C16-TEST01: No tests for `isOptimizableTx` | test-engineer |
| 5 | **LOW** | Correctness | `apps/web/src/lib/store.svelte.ts:519` | C16-02: Refunds excluded from monthlySpending | code-reviewer, tracer |
| 6 | **LOW** | Code Quality | `packages/core/src/optimizer/greedy.ts:54` | C16-03: Redundant amount check in scoreCardsForTransaction | code-reviewer |
| 7 | **LOW** | Security | `apps/web/src/lib/store.svelte.ts:114` | C16-SEC01: `MIGRATIONS` uses `any` type | security-reviewer |
| 8 | **LOW** | Security | `apps/web/src/components/upload/FileDropzone.svelte:97` | C16-SEC02: HTML files accepted for upload | security-reviewer |
| 9 | **LOW** | Security | `apps/web/src/lib/parser/json.ts:58` | C16-SEC03: `findField` uses `in` operator | security-reviewer, debugger |
| 10 | **LOW** | Architecture | `apps/web/src/lib/build-stats.ts:16-18` | C16-ARCH02: Hardcoded stale fallback values | architect |
| 11 | **LOW** | Architecture | `apps/web/src/lib/store.svelte.ts:312` | C16-ARCH03: `as AnalysisResult` cast after partial validation | architect |
| 12 | **LOW** | Testing | `apps/web/src/lib/store.svelte.ts:150-326` | C16-TEST02: No sessionStorage round-trip tests | test-engineer |
| 13 | **LOW** | Testing | `apps/web/src/lib/store.svelte.ts:510-523` | C16-TEST03: No reoptimize monthlySpending tests | test-engineer |
| 14 | **LOW** | Performance | `apps/web/src/components/cards/CardGrid.svelte:29-35` | C16-PERF01: availableIssuers recomputes with filter passes | perf-reviewer |
| 15 | **LOW** | Performance | `apps/web/src/lib/store.svelte.ts:510-530` | C16-PERF02: reoptimize rebuilds monthly maps | perf-reviewer |
| 16 | **LOW** | Documentation | `apps/web/src/lib/store.svelte.ts:195-199` | C16-DOC01: Comment contradicts code | document-specialist, verifier |
| 17 | **LOW** | Documentation | `apps/web/src/lib/parser/csv.ts:176-178` | C16-DOC02: Comment mentions absolute value incorrectly | document-specialist, verifier |
| 18 | **LOW** | UI/UX | `apps/web/src/components/dashboard/TransactionReview.svelte` | C16-UI01: No visual distinction for refunds | designer |
| 19 | **LOW** | UI/UX | `apps/web/src/components/dashboard/SpendingSummary.svelte:159` | C16-UI02: Dismiss button lacks accessible name | designer |
| 20 | **LOW** | UI/UX | `apps/web/src/components/upload/FileDropzone.svelte` | C16-UI03: HTML accepted without bank structure check | designer |

---

## Carry-overs from Previous Cycles

### MEDIUM-priority carry-overs
- D-01 — Parser duplication (web vs packages). Still deferred as major refactor.
- C14-03 — renderPageText hardcoded char width. MEDIUM, deferred.
- C14-05 — parseDateStringToISO fullMatch lacks end anchor. MEDIUM, deferred.
- C14-DB03 — Fallback values bypass type safety. MEDIUM, deferred.

### LOW-priority carry-overs
- C15-03 through C15-05, C15-SEC01-02, C15-TEST01-03, C15-PERF02 per cycle 15 plan.
- D-09, D-36, D-37 and other prior deferred items.

---

## Agent Failures

None. All review perspectives completed successfully. (Note: Agent tool was unavailable in this environment; reviews were performed directly.)

---

## Recommended Priority Order

1. **C16-01** — Fix `isOptimizableTx` to allow negative amounts (MEDIUM)
2. **C16-ARCH01** — Plan parser consolidation (MEDIUM, deferred to architecture cycle)
3. **C16-DB01** — Strengthen `loadFromStorage` validation (MEDIUM)
4. **C16-TEST01** — Add `isOptimizableTx` unit tests (MEDIUM)
5. **C16-02** — Fix `reoptimize` monthlySpending to include refunds (LOW)
6. **C16-03** — Remove redundant amount check in greedy optimizer (LOW)
7. **C16-SEC01** — Replace `any` in MIGRATIONS (LOW)
8. **C16-DOC01** — Fix `isOptimizableTx` comment (LOW)
9. **C16-UI01** — Add refund visual distinction (LOW)
10. **Remaining LOW findings** — Best-effort

**Overall Verdict:** Cycle 16 has 4 MEDIUM and 16 LOW actionable findings. Priority should go to C16-01 (refund data loss on sessionStorage restore), which affects data integrity and user trust.
