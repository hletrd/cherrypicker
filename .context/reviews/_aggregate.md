# Cycle 19 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, test-engineer, perf-reviewer, architect, debugger, critic, verifier, tracer, document-specialist, and designer.

Provenance files retained at `.context/reviews/c19-{agent-name}.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C19-AGREED-01 — Monthly spending calculation inconsistent between analyze and reoptimize (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), critic (MEDIUM), verifier (MEDIUM), document-specialist (MEDIUM), tracer (CONFIRMED)
- **Consensus:** `analyzeMultipleFiles` uses gross spending (`tx.amount > 0`) while `reoptimize` uses net spending (`tx.amount !== 0`). Both cite C1-01 with opposite claims. The verifier confirmed gross spending is the correct Korean card issuer convention.
- **Files:** `apps/web/src/lib/analyzer.ts:330`, `apps/web/src/lib/store.svelte.ts:508`
- **Fix:** Change `reoptimize` to use `tx.amount > 0` and correct the comment.

### C19-AGREED-02 — esc() double-encoded HTML entity bypass (LOW-MEDIUM)
- **Agents:** code-reviewer (LOW), security-reviewer (MEDIUM)
- **Consensus:** Input like `&#x3C;script&#x3E;` becomes `&amp;#x3C;script&amp;#x3E;` which browsers decode back to `<script>`. Currently low risk because data paths are trusted, but latent XSS vector.
- **File:** `packages/viz/src/report/generator.ts:31-42`
- **Fix:** Use a proper HTML encoding library or decode entities before escaping.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `apps/web/src/lib/store.svelte.ts:508` | C19-CR01/DB01: Monthly spending uses net (not gross) in reoptimize | code-reviewer, debugger, critic, verifier, tracer, document-specialist |
| 2 | **MEDIUM** | Correctness | `apps/web/src/lib/analyzer.ts:103` | C19-CR02: Unsafe cast `options?.bank as BankId` | code-reviewer |
| 3 | **MEDIUM** | Security | `packages/viz/src/report/generator.ts:31-42` | C19-SEC01/CR03: Double-encoding bypass in esc() | security-reviewer, code-reviewer |
| 4 | **MEDIUM** | Architecture | `apps/web/src/lib/analyzer.ts:44-72` | C19-ARCH01: Cache not keyed by cardIds filter | architect |
| 5 | **MEDIUM** | Testing | `packages/parser/__tests__/, apps/web/__tests__/` | C19-TEST01: No parity tests for new parser formats | test-engineer |
| 6 | **MEDIUM** | Documentation | `apps/web/src/lib/{analyzer,store.svelte}.ts:327-519` | C19-DOC02: Conflicting C1-01 comments | document-specialist, verifier |
| 7 | **LOW** | Performance | `packages/core/src/optimizer/greedy.ts:51-52` | C19-PERF01: Card output recalculated per tx | perf-reviewer |
| 8 | **LOW** | Correctness | `apps/web/src/lib/parser/ofx.ts:76-82` | C19-DB02: OFX amount lacks full-width normalization | debugger |
| 9 | **LOW** | Testing | `apps/web/__tests__/tx-validation.test.ts` | C19-TEST04: Missing negative amount tests | test-engineer |
| 10 | **LOW** | Testing | `packages/parser/__tests__/ofx.test.ts` | C19-TEST03: No CCSTMTRS credit card tests | test-engineer |
| 11 | **LOW** | Testing | `__tests__/parser-html.test.ts` | C19-TEST02: No summary row forward-fill test | test-engineer |
| 12 | **LOW** | UI/UX | `apps/web/src/components/upload/FileDropzone.svelte:88-93` | C19-UI01: Step indicator lacks progress granularity | designer |
| 13 | **LOW** | Architecture | `apps/web/src/lib/parser/` | C19-CRIT02: Server/web parser duplication expanded | critic |
| 14 | **LOW** | Security | `packages/parser/src/ofx/index.ts:61-65` | C19-SEC02: Dynamic regex pattern (safe today) | security-reviewer |

---

## Carry-overs from Previous Cycles

### CRITICAL / HIGH-priority carry-overs
- **A-ARCH-01** — Server/web parser duplication (CRITICAL, now expanded to 6 formats)
- **A-ARCH-03** — CardRuleSet inline definition in web app (HIGH)
- **T6-02** — No parity tests between server and web parsers (HIGH, now more urgent)

### MEDIUM-priority carry-overs
- **C-CR-01** — Non-KRW transactions silently dropped (MEDIUM)
- **S-SEC-05** — Regex denial of service in column patterns (MEDIUM)
- **P2-MEDIUM** — PDF text extraction materializes entire document (MEDIUM)

### LOW-priority carry-overs
- **U-DES-02 through U-DES-04** — UI/UX gaps (LOW)
- **F-DOC-01 through F-DOC-05** — Documentation gaps (LOW)

---

## Agent Failures

None. All review perspectives completed successfully. (Agent tool unavailable; reviews performed directly.)

---

## Recommended Priority Order

1. **C19-CR01/C19-DB01/C19-DOC02** — Fix monthly spending inconsistency in reoptimize (MEDIUM)
2. **C19-CR02** — Add runtime BankId validation (MEDIUM)
3. **C19-SEC01** — Address esc() double-encoding (MEDIUM)
4. **C19-ARCH01** — Investigate cache key for toCoreCardRuleSets (MEDIUM)
5. **C19-TEST01** — Add parser parity tests (MEDIUM)
6. **C19-DB02** — Add full-width normalization to OFX amount parser (LOW)
7. **Remaining LOW findings** — Best-effort

**Overall Verdict:** Cycle 19 has 6 MEDIUM and 8 LOW actionable findings. The dominant theme is "consistency" — the reoptimize path diverges from initial analysis on monthly spending calculation, producing different results for the same data. Priority should go to C19-CR01 to ensure analyze and reoptimize produce matching monthly breakdowns.
