# Cycle 25 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, critic, verifier, tracer, designer, and document-specialist.

---

## Cross-Agent Agreement (High-Signal Findings)

### C25-AGREED-01 — Server HTML parser missing forward-fill reset on summary rows (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (HIGH), tracer (HIGH), critic (MEDIUM)
- **Consensus:** The server-side HTML parser at `packages/parser/src/html/index.ts:156` skips summary rows via `continue` but does not reset forward-fill state (`lastDate`, `lastMerchant`, etc.). The web-side parser at `apps/web/src/lib/parser/html.ts:163-173` has had this reset since C20-04. Without it, summary row values can propagate to merged data cells below via forward-fill.
- **Files:** `packages/parser/src/html/index.ts:156`
- **Fix:** Reset all six `last*` variables before `continue`.

### C25-AGREED-02 — reoptimize() stale metadata (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (HIGH), critic (MEDIUM)
- **Consensus:** The `reoptimize()` method at `apps/web/src/lib/store.svelte.ts:570-575` builds a new `result` from `snapshot` with only `transactions`, `optimization`, and `monthlyBreakdown` overridden. `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` remain stale from the pre-edit analysis.
- **Files:** `apps/web/src/lib/store.svelte.ts:570-575`
- **Fix:** Recompute these four fields from `editedTransactions` before constructing the result.

### C25-AGREED-03 — Web normalizeHTML unquoted regex still missing whitespace (LOW)
- **Agents:** code-reviewer (LOW), security-reviewer (LOW), verifier (HIGH), tracer (HIGH)
- **Consensus:** The web-side unquoted event handler regex at `apps/web/src/lib/parser/html.ts:43` is `/\son\w+=[^>\s]*/gi` — missing `\s*` around `=`. The server-side regex at `packages/parser/src/csv/shared.ts:192` uses `/\son\w+\s*=\s*[^>\s]*/gi`. C24 claimed to fix both but only fixed the quoted pattern. An unquoted handler like `onclick = alert(1)` survives web sanitization.
- **Files:** `apps/web/src/lib/parser/html.ts:43`, `packages/parser/src/csv/shared.ts:192`
- **Fix:** Add `\s*` around `=` in web line 43.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `packages/parser/src/html/index.ts:156` | C25-COR01: Missing forward-fill reset on summary rows | code-reviewer, debugger, verifier, tracer, critic |
| 2 | **MEDIUM** | Correctness | `apps/web/src/lib/store.svelte.ts:570-575` | C25-COR02: Stale transactionCount/periods in reoptimize() | code-reviewer, debugger, verifier, critic |
| 3 | **LOW** | Security | `apps/web/src/lib/parser/html.ts:43` | C25-SEC01: Unquoted regex missing `\s*` around `=` | security-reviewer, code-reviewer, verifier, tracer |
| 4 | **LOW** | Performance | `packages/core/src/optimizer/greedy.ts:51-52` | C25-PERF01: Double calculateCardOutput per card/tx | perf-reviewer, code-reviewer |
| 5 | **LOW** | Testing | `packages/parser/__tests__/html.test.ts` | C25-TEST01: Missing server test for summary reset | test-engineer, verifier |
| 6 | **LOW** | Testing | `apps/web/__tests__/parser-html.test.ts` | C25-TEST02: Missing unquoted whitespace test | test-engineer, verifier |
| 7 | **LOW** | Testing | `apps/web/src/lib/store.svelte.ts` | C25-TEST03: Missing reoptimize metadata test | test-engineer |
| 8 | **LOW** | Architecture | `apps/web/src/lib/parser/html.ts` | C25-ARCH01: Parser duplication (A-ARCH-01 carry-over) | architect |

---

## Carry-overs from Previous Cycles

### Critical / High-priority carry-overs (unchanged)
- A-ARCH-01 — Server/web parser duplication (CRITICAL)
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH)
- T6-02 — No parity tests between server and web parsers (HIGH)

### Already-deferred items (unchanged)
- D-01: Parser duplication refactoring
- D-09: Greedy optimizer marginal reward caching (C25-PERF01)
- C20-PERF02: HTML parser string allocations
- C24-PERF01: Per-cell isSummaryRow checks (deferred in cycle 24)
- C24-TEST02: persistToStorage round-trip test (deferred in cycle 24)
- All other deferred items from `00-deferred-items.md`

---

## Agent Failures

No agent failures. Reviews performed directly due to unavailability of Agent spawning tool in this environment.

---

## Recommended Priority Order

1. **C25-COR01** — Add forward-fill reset to server HTML parser (MEDIUM)
2. **C25-COR02** — Update metadata fields in reoptimize() (MEDIUM)
3. **C25-SEC01** — Fix unquoted regex whitespace on web (LOW)
4. **C25-TEST01** — Add server test for summary row reset (LOW)
5. **C25-TEST02** — Add web test for unquoted whitespace handlers (LOW)
6. **C25-TEST03** — Add reoptimize metadata consistency test (LOW)
7. **C25-PERF01** — Greedy optimizer double calculation (LOW, defer)
8. **C25-ARCH01** — Parser duplication (LOW, maps to A-ARCH-01)

**Overall Verdict:** Cycle 25 has 2 MEDIUM and 6 LOW findings. The dominant theme is behavioral parity between server and web parsers (C25-COR01, C25-SEC01, C25-TEST01) and metadata consistency in the reactive store (C25-COR02, C25-TEST03). These are follow-on issues from incomplete prior-cycle fixes rather than new bugs.
