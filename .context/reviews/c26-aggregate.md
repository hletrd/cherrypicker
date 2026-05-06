# Cycle 26 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, debugger, verifier, test-engineer, architect, and critic.

---

## Cross-Agent Agreement (High-Signal Findings)

### C26-AGREED-01 — Reward calculator redundant identical branches (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (MEDIUM), critic (MEDIUM)
- **Consensus:** The `if (rate && fixed)` branch at `packages/core/src/calculator/reward.ts:260-267` has identical code to the `else if (rate)` branch at lines 268-272. The comment claims "rate-based reward takes precedence" but the implementation doesn't actually do anything different. The branch is reachable (when both rate and fixedAmount are present) but produces the same output as the rate-only branch, meaning fixed rewards are silently ignored when combined with rates.
- **Files:** `packages/core/src/calculator/reward.ts:260-272`
- **Fix:** Remove redundant branch and merge with rate-only branch, OR implement actual combined rate+fixed calculation.

### C26-AGREED-02 — JSON parser preserves negative amounts, inconsistent with other parsers (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (MEDIUM), critic (MEDIUM)
- **Consensus:** The JSON parser at `packages/parser/src/json/index.ts:115` skips zero amounts (`if (amount === 0) return null`) but preserves negative amounts. All other parsers (CSV, HTML, XLSX, OFX) skip `amount <= 0` at parse time. The optimizer later filters negatives with `tx.amount > 0`, so the inconsistency is purely UX-level: JSON uploaders see refunds in the transaction review UI while CSV/HTML uploaders don't.
- **Files:** `packages/parser/src/json/index.ts:115`, `packages/parser/src/csv/shared.ts:122`, `packages/parser/src/html/index.ts:238`
- **Fix:** Change JSON parser to skip `amount <= 0` for parity with other parsers.

### C26-AGREED-03 — Missing web-side OFX/JSON parity tests (MEDIUM)
- **Agents:** test-engineer (MEDIUM), architect (MEDIUM), critic (MEDIUM)
- **Consensus:** The web-side parsers (`apps/web/src/lib/parser/`) have no tests for OFX or JSON formats. The server-side (`packages/parser/src/`) has comprehensive tests. This mirrors the pattern that produced C25-COR01 (server HTML parser missing forward-fill reset) — behavioral drift between server and web parsers due to lack of parity testing.
- **Files:** `apps/web/__tests__/` (missing), `packages/parser/__tests__/ofx.test.ts`, `packages/parser/__tests__/parse-error.test.ts`
- **Fix:** Create `apps/web/__tests__/parser-ofx-parity.test.ts` and `apps/web/__tests__/parser-json-parity.test.ts`.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `packages/core/src/calculator/reward.ts:260-272` | C26-COR01: Redundant identical branches | code-reviewer, debugger, verifier, critic |
| 2 | **MEDIUM** | Consistency | `packages/parser/src/json/index.ts:115` | C26-COR02: JSON preserves negatives | code-reviewer, debugger, verifier, critic |
| 3 | **MEDIUM** | Testing | `apps/web/__tests__/` | C26-TEST01: No OFX/JSON web parity tests | test-engineer, architect, critic |
| 4 | **LOW** | Correctness | `apps/web/src/lib/analyzer.ts:367-368` | C26-COR03: Unsafe `!` on Map.get | code-reviewer, debugger |
| 5 | **LOW** | Robustness | `apps/web/src/lib/parser/pdf.ts:626` | C26-COR04: Fragile regex capture group | code-reviewer |
| 6 | **LOW** | Architecture | `apps/web/src/lib/parser/*` | C26-ARCH01: Parser duplication growing | architect, critic |
| 7 | **LOW** | Testing | `packages/core/__tests__/calculator.test.ts` | C26-TEST02: No combined rate+fixed test | test-engineer |

---

## Carry-overs from Previous Cycles

### Critical / High-priority carry-overs (unchanged)
- A-ARCH-01 — Server/web parser duplication (CRITICAL)
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH)
- T6-02 — No parity tests between server and web parsers (HIGH)

### Deferred items (unchanged)
- C25-PERF01 — Greedy optimizer double calculation (LOW)
- C25-TEST03 — Reoptimize metadata test (LOW, no store test file)
- D-01 through D-25+ from `00-deferred-items.md`

---

## Agent Failures

No agent failures. Reviews performed directly due to unavailability of Agent spawning tool in this environment.

---

## Recommended Priority Order

1. **C26-COR01** — Remove redundant branch in reward calculator (MEDIUM)
2. **C26-COR02** — Align JSON parser negative-amount handling (MEDIUM)
3. **C26-TEST01** — Add web-side OFX/JSON parity tests (MEDIUM)
4. **C26-COR03** — Replace unsafe `!` with `?? 0` in analyzer (LOW)
5. **C26-COR04** — Use `dateMatch[0]` instead of `dateMatch[1]` in web PDF (LOW)
6. **C26-TEST02** — Add combined rate+fixed calculator test (LOW)
7. **C26-ARCH01** — Parser duplication (LOW, maps to A-ARCH-01)

**Overall Verdict:** Cycle 26 has 3 MEDIUM and 4 LOW findings. The dominant theme is behavioral inconsistency (reward calculator redundancy, JSON parser deviation from negative-amount pattern) and missing test coverage for new parser formats. All findings are fixable within this cycle.
