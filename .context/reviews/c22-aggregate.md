# Cycle 22 — Aggregate Review (2026-05-05)

Deduplicated findings across code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, and verifier.

---

## Cross-Agent Agreement (High-Signal Findings)

None this cycle. All findings are single-agent.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **LOW** | Security | `apps/web/src/lib/parser/html.ts:39-40` | C22-SEC01: Event handler regex gap — `onclick=alert(1)` not stripped | security-reviewer |
| 2 | **LOW** | Code Quality | `apps/web/src/lib/parser/csv.ts:316` | C22-CR01: Korean regex extends beyond valid Hangul (힯 vs 힣) | code-reviewer |
| 3 | **LOW** | Performance | `apps/web/src/lib/store.svelte.ts:170` | C22-PERF01: SessionStorage size check uses chars not bytes | perf-reviewer |
| 4 | **LOW** | Testing | `apps/web/src/lib/parser/html.ts` | C22-TEST01: No test for HTML event handler sanitization | test-engineer |
| 5 | **LOW** | Testing | `apps/web/src/lib/store.svelte.ts:170-176` | C22-TEST02: No test for sessionStorage truncation path | test-engineer |
| 6 | **LOW** | Testing | `packages/parser/src/date-utils.ts` | C22-TEST03: No test for full-width dot date parsing | test-engineer |
| 7 | **LOW** | Architecture | `packages/parser/src/csv/shared.ts` + `apps/web/src/lib/parser/html.ts` | C22-ARCH01: normalizeHTML still duplicated web-side | architect |
| 8 | **LOW** | Correctness | `apps/web/src/lib/store.svelte.ts:174` | C22-DEBUG01: Truncation keeps original transactionCount | debugger |
| 9 | **LOW** | Code Quality | `apps/web/src/lib/parser/json.ts:98-100` | C22-CR03: Negative amounts rely on optimizer filter | code-reviewer |

---

## Carry-overs from Previous Cycles

### Critical / High-priority carry-overs (unchanged)
- A-ARCH-01 — Server/web parser duplication (CRITICAL, now 6 formats) — Maps to C22-ARCH01
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH)
- T6-02 — No parity tests between server and web parsers (HIGH) — Partially addressed; XLSX, PDF, detection have parity tests

### Already-deferred items (unchanged)
- D-01: Parser duplication refactoring
- D-09: Greedy optimizer marginal reward caching
- All other deferred items from `00-deferred-items.md`

---

## Agent Failures

No agent failures this cycle. All requested review agents completed successfully.
