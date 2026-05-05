# Cycle 18 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, security-reviewer, test-engineer, perf-reviewer, architect, debugger, critic, verifier, tracer, document-specialist, and designer.

Provenance files retained at `.context/reviews/c18-{agent-name}.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C18-01 — `loadFromStorage` callback parameters still use `any` (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (LOW), verifier (PARTIAL), critic (MEDIUM)
- **Consensus:** The `MIGRATIONS` Record type was fixed from `any` to `unknown` in cycle 17, but `.filter()` and `.map()` callbacks at lines 247 and 286 in `store.svelte.ts` still use `any`. This is a partial fix that leaves type-safety gaps in the persistence layer.
- **Fix:** Replace `cr: any` and `item: any` with `unknown` and add type guards.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `apps/web/src/lib/store.svelte.ts:247,286` | C18-01: Callback `any` types in persistence code | code-reviewer, debugger, critic |
| 2 | **MEDIUM** | Testing | `packages/parser/__tests__/parse-error.test.ts:34-43` | C18-TEST02: Vacuous structural test (carry-over C6-05) | test-engineer, code-reviewer |
| 3 | **MEDIUM** | Testing | `apps/web/src/lib/parser/types.ts:30-47` | C18-TEST01: No web-side ParseError class tests | test-engineer |
| 4 | **MEDIUM** | Documentation | `packages/parser/src/{json,ofx,html}/` | C18-DOC01: New parser formats undocumented | document-specialist |
| 5 | **LOW** | Code Quality | `packages/viz/src/report/generator.ts:41` | C18-SEC01: `esc()` backslash replacement unnecessary | security-reviewer |
| 6 | **LOW** | Architecture | `apps/web/src/lib/analyzer.ts:44-72` | C18-ARCH01: `toCoreCardRuleSets` cache keyed by existence | architect |
| 7 | **LOW** | Correctness | `packages/core/src/optimizer/greedy.ts:86` | C18-DB01: Rate recalculation assumes pre-filter invariant | debugger |
| 8 | **LOW** | Performance | `packages/core/src/optimizer/greedy.ts:86` | C18-PERF01: Rate recalculated on every accumulation | perf-reviewer |
| 9 | **LOW** | UI/UX | `apps/web/src/components/upload/FileDropzone.svelte:88-93` | C18-UI01: Step indicator lacks actual progress binding | designer |

---

## Carry-overs from Previous Cycles

### CRITICAL / HIGH-priority carry-overs
- **A-ARCH-01** — Server/web parser duplication (CRITICAL, open since cycle 2)
- **A-ARCH-03** — CardRuleSet inline definition in web app (HIGH, open since cycle 4)
- **T6-02** — No parity tests between server and web parsers (HIGH)

### MEDIUM-priority carry-overs
- **C-CR-01** — Non-KRW transactions silently dropped (MEDIUM)
- **C-CR-04** — Web app redefines CardRuleSet inline (MEDIUM, same as A-ARCH-03)
- **S-SEC-05** — Regex denial of service in column patterns (MEDIUM)
- **P2-MEDIUM** — PDF text extraction materializes entire document (MEDIUM)
- **P2-MEDIUM** — Taxonomy keywordMap iterates all entries (MEDIUM)

### LOW-priority carry-overs
- **U-DES-02** — Error messages not user-friendly (LOW)
- **U-DES-03** — No loading state during analysis (LOW)
- **U-DES-04** — Results display lacks transaction detail (LOW)
- **F-DOC-01 through F-DOC-05** — Documentation gaps (LOW)
- **C16-03** — Redundant amount check in greedy optimizer (FIXED in cycle 16)

---

## Agent Failures

None. All review perspectives completed successfully. (Agent tool unavailable; reviews performed directly.)

---

## Recommended Priority Order

1. **C18-01** — Fix `any` types in `loadFromStorage` callbacks (MEDIUM)
2. **C18-TEST02** — Fix vacuous parse-error structural test (MEDIUM)
3. **C18-TEST01** — Add web-side ParseError class unit tests (MEDIUM)
4. **C18-DOC01** — Document new parser formats (MEDIUM)
5. **C18-ARCH01** — Add cache key to `toCoreCardRuleSets` (LOW)
6. **C18-SEC01** — Remove backslash from `esc()` (LOW)
7. **Remaining LOW findings** — Best-effort

**Overall Verdict:** Cycle 18 has 4 MEDIUM and 5 LOW actionable findings. The dominant theme is "finishing partial fixes" — cycle 17 fixed the headline `MIGRATIONS any` type but left adjacent `any` types in the same file. Priority should go to C18-01 to close the type-safety gap.
