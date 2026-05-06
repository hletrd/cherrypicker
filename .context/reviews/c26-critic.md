# Cycle 26 — Critic Findings

**Date:** 2026-05-06
**Scope:** Multi-perspective critique of the whole change surface
**Method:** Synthesis of code-reviewer, debugger, architect, verifier, and test-engineer findings

---

## Cross-Agent Agreement

### C26-AGREED-01 — Reward calculator redundant branch (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (MEDIUM), architect (LOW)
- **Consensus:** The `if (rate && fixed)` branch at `packages/core/src/calculator/reward.ts:260-267` has identical code to the `else if (rate)` branch at lines 268-272. The comment claims "rate takes precedence" but doesn't actually implement precedence — it just duplicates the rate-only logic.
- **Fix:** Remove redundant branch or implement actual combined calculation.

### C26-AGREED-02 — JSON parser negative amount inconsistency (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (MEDIUM)
- **Consensus:** JSON parser preserves negative amounts while CSV/HTML/XLSX/OFX parsers skip them. The optimizer filters them out later, so the inconsistency is purely UX-level. Users see refunds for JSON uploads but not for other formats.
- **Fix:** Align JSON with other parsers (`amount <= 0` skip).

### C26-AGREED-03 — Missing web-side OFX/JSON parity tests (MEDIUM)
- **Agents:** test-engineer (MEDIUM), architect (MEDIUM)
- **Consensus:** Web-side OFX and JSON parsers have no tests, creating the same drift risk that produced C25-COR01 (HTML forward-fill parity bug).
- **Fix:** Add parity tests for OFX and JSON.

---

## Deduplicated Findings

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `packages/core/src/calculator/reward.ts:260-272` | C26-COR01: Redundant identical branches for rate+fixed vs rate-only | code-reviewer, debugger, verifier |
| 2 | **MEDIUM** | Consistency | `packages/parser/src/json/index.ts:115` | C26-COR02: JSON preserves negatives, other parsers skip them | code-reviewer, debugger, verifier |
| 3 | **MEDIUM** | Testing | `apps/web/__tests__/` | C26-TEST01: No web-side OFX/JSON parity tests | test-engineer, architect |
| 4 | **LOW** | Correctness | `apps/web/src/lib/analyzer.ts:367-368` | C26-COR03: Unsafe `!` on Map.get | code-reviewer, debugger |
| 5 | **LOW** | Robustness | `apps/web/src/lib/parser/pdf.ts:626` | C26-COR04: Fragile regex capture group assumption | code-reviewer |
| 6 | **LOW** | Architecture | `apps/web/src/lib/parser/*` | C26-ARCH01: Parser duplication growing with new formats | architect |
| 7 | **LOW** | Testing | `packages/core/__tests__/calculator.test.ts` | C26-TEST02: No test for combined rate+fixed branch | test-engineer |

---

## Carry-overs

- A-ARCH-01 — Parser duplication (CRITICAL, deferred)
- C25-PERF01 — Greedy optimizer double calculation (LOW, deferred)
- C25-TEST03 — Reoptimize metadata test (LOW, deferred from cycle 25)
- All deferred items from `00-deferred-items.md`

---

## Overall Assessment

Cycle 26 has **3 MEDIUM** and **4 LOW** findings. The dominant theme is **behavioral inconsistency** — the reward calculator has redundant code paths, and the JSON parser deviates from the negative-amount handling pattern used by all other parsers. The missing web-side OFX/JSON tests mirror the pattern that led to HTML parity bugs in prior cycles.

None of the findings are security-critical or data-loss risks. All are fixable within this cycle.

**Verdict:** FIX AND SHIP
