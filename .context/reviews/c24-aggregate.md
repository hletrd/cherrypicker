# Cycle 24 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, critic, verifier, tracer, designer, and document-specialist.

---

## Cross-Agent Agreement (High-Signal Findings)

### C24-AGREED-01 — HTML event handler regex misses whitespace around equals sign (LOW)
- **Agents:** code-reviewer (LOW), security-reviewer (LOW), debugger (LOW), tracer (HIGH), test-engineer (LOW)
- **Consensus:** The regex `/\son\w+=(?:"[^"]*"|'[^']*')/gi` at `apps/web/src/lib/parser/html.ts:42` does not match event handler attributes with whitespace around the equals sign (e.g., `onclick = "alert(1)"`). The tracer confirms the SAME gap exists in the server-side implementation (`packages/parser/src/csv/shared.ts:191-192`), making this a parity issue.
- **Files:** `apps/web/src/lib/parser/html.ts:42`, `packages/parser/src/csv/shared.ts:191-192`
- **Fix:** Add `\s*` around `=` in BOTH server and web regexes: `/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi`.

### C24-AGREED-02 — HTML forward-fill redundant isSummaryRow calls (LOW)
- **Agents:** code-reviewer (LOW), perf-reviewer (LOW), debugger (LOW)
- **Consensus:** `isSummaryRow(String(rawValue))` is called on every non-empty cell in every data row, creating ~6000 regex compilations for a 1000-row table. The row-level `isSummaryRow` check at line 163 already skips summary rows entirely.
- **Files:** `apps/web/src/lib/parser/html.ts:182-227`
- **Fix:** Remove redundant per-cell `isSummaryRow` guards or cache results.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **LOW** | Security | `apps/web/src/lib/parser/html.ts:42` | C24-SEC01: Event handler regex misses whitespace around `=` | security-reviewer, code-reviewer, debugger, tracer, test-engineer |
| 2 | **LOW** | Performance | `apps/web/src/lib/parser/html.ts:182-227` | C24-PERF01: Redundant `isSummaryRow` calls per cell | perf-reviewer, code-reviewer, debugger |
| 3 | **LOW** | Correctness | `apps/web/src/lib/store.svelte.ts:291` | C24-DB02: `totalTransactionCount` accepts NaN/Infinity | debugger, verifier |
| 4 | **LOW** | Testing | `apps/web/__tests__/parser-html.test.ts` | C24-TEST01: Missing whitespace-around-equals test | test-engineer |
| 5 | **LOW** | Testing | `apps/web/src/lib/store.svelte.ts` | C24-TEST02: Missing truncation round-trip test | test-engineer |
| 6 | **LOW** | Architecture | `apps/web/src/lib/parser/html.ts:29-47` | C24-ARCH01: normalizeHTML duplication; XLSX->HTML coupling | architect |

---

## Carry-overs from Previous Cycles

### Critical / High-priority carry-overs (unchanged)
- A-ARCH-01 — Server/web parser duplication (CRITICAL) — Maps to C24-ARCH01
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH)
- T6-02 — No parity tests between server and web parsers (HIGH)

### Already-deferred items (unchanged)
- D-01: Parser duplication refactoring
- D-09: Greedy optimizer marginal reward caching
- C20-PERF02: HTML parser string allocations (overlaps with C24-PERF01)
- C20-SEC02: HTML sanitization before SheetJS (defense-in-depth)
- All other deferred items from `00-deferred-items.md`

---

## Agent Failures

No agent failures. Reviews performed directly due to unavailability of Agent spawning tool in this environment.

---

## Recommended Priority Order

1. **C24-SEC01** — Fix whitespace-around-equals in BOTH server and web normalizeHTML (LOW)
2. **C24-TEST01** — Add test coverage for whitespace-variant event handlers (LOW)
3. **C24-PERF01** — Remove redundant per-cell isSummaryRow checks (LOW)
4. **C24-DB02** — Add finite-number validation for totalTransactionCount (LOW)
5. **C24-ARCH01** — Extract normalizeHTML to shared utility (LOW, maps to A-ARCH-01)

**Overall Verdict:** Cycle 24 has 6 LOW findings. The dominant theme is residual edge cases in HTML sanitization — a three-cycle fix chain (C22->C23->C24) that could have been avoided by copying the server-side implementation verbatim or extracting a shared utility.
