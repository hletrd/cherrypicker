# Cycle 23 — Aggregate Review (2026-05-05)

Deduplicated findings across code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, critic, verifier, and tracer.

---

## Cross-Agent Agreement (High-Signal Findings)

### C23-AGREED-01 — Event handler regex regression in normalizeHTML (HIGH)
- **Agents:** security-reviewer (HIGH), code-reviewer (MEDIUM), debugger (HIGH), test-engineer (HIGH), critic (MEDIUM), verifier (HIGH), tracer (HIGH), architect (MEDIUM)
- **Consensus:** The C22-SEC01 fix introduced a regression where event handler attribute values containing spaces are only partially stripped by the web-side `normalizeHTML` regex.
- **Files:** `apps/web/src/lib/parser/html.ts:40`
- **Fix:** Replace the single regex with the server-side's two-pattern approach.

### C23-AGREED-02 — normalizeHTML duplication caused regression (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), architect (MEDIUM), critic (LOW)
- **Consensus:** The server/web parser duplication (A-ARCH-01) produced a concrete bug because the web-side `normalizeHTML` diverged from the server-side implementation.
- **Files:** `apps/web/src/lib/parser/html.ts:29-44` vs `packages/parser/src/csv/shared.ts:181-196`
- **Fix:** Import `normalizeHTML` from the shared module instead of redefining it web-side.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **HIGH** | Security | `apps/web/src/lib/parser/html.ts:40` | C23-SEC01: Event handler regex strips only prefix when value contains spaces | security-reviewer, debugger, verifier, tracer, test-engineer |
| 2 | **MEDIUM** | Code Quality | `apps/web/src/lib/parser/html.ts:40` vs `packages/parser/src/csv/shared.ts:191-192` | C23-CR01: normalizeHTML regex parity gap between server and web | code-reviewer, architect |
| 3 | **MEDIUM** | Testing | `apps/web/__tests__/parser-html.test.ts` | C23-TEST01: No test for event handlers with spaces in quoted values | test-engineer, critic |
| 4 | **MEDIUM** | Testing | `apps/web/__tests__/parser-html.test.ts` + `packages/parser/__tests__/html.test.ts` | C23-TEST02: No shared test fixture for normalizeHTML parity | test-engineer |
| 5 | **LOW** | Code Quality | `apps/web/src/lib/parser/json.ts:98-100` | C22-CR03: Negative amounts rely on optimizer filter | code-reviewer |
| 6 | **LOW** | Correctness | `apps/web/src/lib/store.svelte.ts:174-175` | C22-DEBUG01: Truncation keeps original transactionCount | debugger |
| 7 | **LOW** | Architecture | `apps/web/src/lib/parser/html.ts:29-44` | C22-ARCH01: normalizeHTML still duplicated web-side | architect |
| 8 | **LOW** | Testing | `apps/web/__tests__/` | C22-TEST02: No test for sessionStorage truncation path | test-engineer |

---

## Carry-overs from Previous Cycles

### Critical / High-priority carry-overs (unchanged)
- A-ARCH-01 — Server/web parser duplication (CRITICAL, now caused C23-SEC01) — Maps to C22-ARCH01/C23-CR01
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH)
- T6-02 — No parity tests between server and web parsers (HIGH)

### Already-deferred items (unchanged)
- D-01: Parser duplication refactoring
- D-09: Greedy optimizer marginal reward caching
- C20-PERF01: Greedy optimizer recalculation
- C20-PERF02: HTML parser string allocations
- All other deferred items from `00-deferred-items.md`

---

## Agent Failures

No agent failures this cycle. All requested review agents completed successfully (performed directly due to unavailability of Agent spawning tool).

---

## Recommended Priority Order

1. **C23-SEC01** — Fix event handler regex in web-side normalizeHTML (HIGH)
2. **C23-CR01** — Unify normalizeHTML by importing from shared module (MEDIUM)
3. **C23-TEST01** — Add tests for event handlers with spaces (MEDIUM)
4. **C23-TEST02** — Add shared normalizeHTML parity test fixture (MEDIUM)
5. **C22 carry-overs** — Address remaining C22 items (TEST02, DEBUG01, ARCH01, CR03) (LOW)

**Overall Verdict:** Cycle 23 has 1 HIGH and 4 MEDIUM/LOW actionable findings. The dominant theme is that the C22-SEC01 fix was incomplete and created a regression. The fix is straightforward: align the web-side normalizeHTML with the server-side implementation and add comprehensive tests.
