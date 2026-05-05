# Cycle 21 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, test-engineer, perf-reviewer, architect, and debugger.

---

## Cross-Agent Agreement (High-Signal Findings)

### C21-AGREED-01 — Web-side XLSX parser duplicates parseAmountString (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (LOW)
- **Consensus:** Web-side XLSX parser has its own `parseAmount()` that reimplements full-width digit normalization, Won sign stripping, `마이너스` handling, etc. Server-side imports `parseAmountString` from shared module.
- **Files:** `apps/web/src/lib/parser/xlsx.ts:308-342`
- **Fix:** Remove local `parseAmount`, import `parseAmountString` from `./csv.ts`.

### C21-AGREED-02 — Full-width plus sign (＋) missing from web-side amount parsing (LOW)
- **Agents:** code-reviewer (LOW), debugger (LOW), test-engineer (LOW)
- **Consensus:** Web-side CSV and XLSX parsers omit `.replace(/＋/g, '+')` which is present in server-side and PDF parsers. Inputs like `＋1,234` will parse to NaN/null and be silently skipped.
- **Files:** `apps/web/src/lib/parser/csv.ts:128`, `apps/web/src/lib/parser/xlsx.ts:318`
- **Fix:** Add `＋` replacement. Best done by fixing C21-01 first (unify XLSX with shared parser).

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `apps/web/src/lib/parser/xlsx.ts:308-342` | C21-01: Duplicated parseAmountString logic | code-reviewer, debugger |
| 2 | **MEDIUM** | Correctness | `apps/web/src/lib/parser/detect.ts:107-118` | C21-02: Format detection lacks content sniffing | code-reviewer, debugger |
| 3 | **LOW** | Correctness | `apps/web/src/lib/parser/csv.ts:128` | C21-03: Missing full-width plus (＋) handling | code-reviewer, debugger, test-engineer |
| 4 | **LOW** | Testing | `apps/web/src/lib/parser/xlsx.ts` | C21-TEST02: No web-side XLSX parser tests | test-engineer |
| 5 | **LOW** | Testing | `apps/web/src/lib/parser/pdf.ts` | C21-TEST03: No web-side PDF parser tests | test-engineer |
| 6 | **LOW** | Testing | `apps/web/src/lib/parser/detect.ts` | C21-TEST04: No format detection tests | test-engineer |
| 7 | **LOW** | Testing | `packages/parser/__tests__/csv-shared.test.ts` | C21-TEST01: Missing full-width plus test | test-engineer |
| 8 | **LOW** | Architecture | `apps/web/src/lib/parser/xlsx.ts:5` | C21-ARCH02: XLSX imports normalizeHTML from HTML module | architect |
| 9 | **LOW** | Architecture | `apps/web/src/lib/parser/` vs `packages/parser/src/` | C21-ARCH01: Parser duplication now 6 formats | architect |

---

## Carry-overs from Previous Cycles

### Critical / High-priority carry-overs (unchanged)
- A-ARCH-01 — Server/web parser duplication (CRITICAL, now 6 formats) — Maps to C21-ARCH01
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH)
- T6-02 — No parity tests between server and web parsers (HIGH)

### Already-deferred items (unchanged)
- D-01: Parser duplication refactoring
- D-09: Greedy optimizer marginal reward caching
- All other deferred items from `00-deferred-items.md`

---

## Agent Failures

No agent failures. Reviews performed directly due to unavailability of Agent spawning tool in this environment.

---

## Recommended Priority Order

1. **C21-01** — Unify web XLSX parseAmount with parseAmountString (MEDIUM)
2. **C21-02** — Add content sniffing to web format detection (MEDIUM)
3. **C21-03** — Add full-width plus sign handling to web CSV parser (LOW)
4. **C21-TEST01-04** — Add tests for new and existing edge cases (LOW)
5. **C21-ARCH02** — Decouple normalizeHTML from HTML module (LOW, optional)

**Overall Verdict:** Cycle 21 has 2 MEDIUM and 7 LOW actionable findings. The dominant theme continues to be "parity" — web and server parsers drift in subtle ways (XLSX amount parsing, format detection). The full-width plus sign gap (C21-03) is a concrete correctness bug that would silently drop valid transactions.
