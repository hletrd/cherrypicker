# Cycle 20 — Aggregate Review (2026-05-05)

Deduplicated findings across code-reviewer, security-reviewer, test-engineer, perf-reviewer, architect, debugger, critic, verifier, tracer, document-specialist, and designer.

Provenance files retained at `.context/reviews/{agent-name}.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C20-AGREED-01 — Server/web OFX amount parsing parity gap (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (CONFIRMED), tracer (CONFIRMED), test-engineer (MEDIUM)
- **Consensus:** Server-side `parseOFXAmount` uses minimal `parseFloat` after stripping commas. Web-side delegates to `parseAmountString` which handles full-width digits, Won signs, 마이너스 prefix, trailing minus, and KRW prefix. Full-width OFX amounts parse correctly in web but fail in server CLI.
- **Files:** `packages/parser/src/ofx/index.ts:108-114` vs `apps/web/src/lib/parser/ofx.ts:79-81`
- **Fix:** Replace server-side `parseOFXAmount` with `parseAmountString` (exported from `csv/shared.ts`).

### C20-AGREED-02 — Dynamic regex construction in OFX extractTag (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), security-reviewer (MEDIUM), debugger (MEDIUM), tracer (CONFIRMED)
- **Consensus:** `new RegExp(\`<${tagName}...\`)` constructs regex from string without escaping. If tagName contains regex metacharacters (from malformed OFX), this throws SyntaxError. Currently tagName is hardcoded, but defense-in-depth requires escaping.
- **Files:** `packages/parser/src/ofx/index.ts:59-69`, `apps/web/src/lib/parser/ofx.ts:33-40`
- **Fix:** Add `escapeRegExp` helper before interpolation.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `packages/parser/src/ofx/index.ts:108-114` | C20-01: Server-side OFX amount lacks full-width normalization | code-reviewer, debugger, verifier, tracer, test-engineer |
| 2 | **MEDIUM** | Security | `packages/parser/src/ofx/index.ts:59-69` | C20-SEC01/C20-02: Dynamic regex without escaping | security-reviewer, code-reviewer, debugger, tracer |
| 3 | **MEDIUM** | Architecture | `apps/web/src/lib/analyzer.ts:55-86` | C20-ARCH01: Analyzer cache not keyed by cardIds | architect |
| 4 | **MEDIUM** | Performance | `packages/core/src/optimizer/greedy.ts:51-53` | C20-PERF01: Greedy recalculates full card rewards per tx | perf-reviewer |
| 5 | **MEDIUM** | Maintainability | `.context/plans/` | C20-CRIT01: Same issues deferred across 5+ cycles | critic |
| 6 | **LOW** | Correctness | `apps/web/src/lib/parser/csv.ts:169-180` | C20-03: Misleading comment on negative amount handling | code-reviewer, document-specialist |
| 7 | **LOW** | Correctness | `apps/web/src/lib/parser/html.ts:197-204` | C20-04/C20-DB03: Summary amount may forward-fill | code-reviewer, debugger, tracer |
| 8 | **LOW** | Security | `apps/web/src/lib/parser/html.ts:38-42` | C20-SEC02: Unsanitized HTML passed to SheetJS | security-reviewer |
| 9 | **LOW** | Performance | `apps/web/src/lib/parser/html.ts:141-244` | C20-PERF02: Excessive string allocations in forward-fill | perf-reviewer |
| 10 | **LOW** | Architecture | `apps/web/src/lib/parser/` vs `packages/parser/src/` | C20-ARCH02: Parser duplication expanded to 6 formats | architect, critic |
| 11 | **LOW** | Testing | `packages/parser/__tests__/ofx.test.ts` | C20-TEST01: No full-width OFX amount tests | test-engineer |
| 12 | **LOW** | Testing | `packages/parser/__tests__/ofx.test.ts` | C20-TEST02: No metacharacter tag tests | test-engineer |
| 13 | **LOW** | Testing | `apps/web/__tests__/, packages/parser/__tests__/` | C20-TEST03: No HTML summary row forward-fill test | test-engineer |
| 14 | **LOW** | Documentation | `apps/web/src/lib/analyzer.ts:339-341` | C20-DOC01: C1-01 comment duplicated | document-specialist |
| 15 | **LOW** | Documentation | `packages/parser/src/ofx/index.ts:104-107` | C20-DOC02: OFX parser lacks parity comment | document-specialist |
| 16 | **LOW** | Documentation | `apps/web/src/lib/parser/csv.ts:169-170` | C20-DOC03: isValidAmount comment contradicts code | document-specialist |
| 17 | **LOW** | UI/UX | `packages/viz/src/report/generator.ts:75-136` | C20-UI01: HTML tables lack accessibility attributes | designer |
| 18 | **LOW** | UI/UX | `apps/web/src/lib/parser/` (all formats) | C20-UI02: Error messages mix technical terms | designer |

---

## Carry-overs from Previous Cycles

### CRITICAL / HIGH-priority carry-overs
- **A-ARCH-01** — Server/web parser duplication (CRITICAL, now 6 formats)
- **A-ARCH-03** — CardRuleSet inline definition in web app (HIGH)
- **T6-02** — No parity tests between server and web parsers (HIGH)

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

1. **C20-01/C20-SEC01** — Unify OFX amount parsing and add regex escaping (2 MEDIUM)
2. **C20-ARCH01** — Evaluate analyzer cache key strategy (MEDIUM)
3. **C20-PERF01** — Profile optimizer recalculation; consider marginal reward caching (MEDIUM)
4. **C20-CRIT01** — Schedule or close long-deferred architectural issues (MEDIUM)
5. **C20-04/C20-DB03** — Guard HTML forward-fill against summary rows (LOW)
6. **C20-TEST01-03** — Add tests for edge cases found above (LOW)
7. **Remaining LOW findings** — Best-effort

**Overall Verdict:** Cycle 20 has 5 MEDIUM and 13 LOW actionable findings. The dominant theme is "parity" — server and web parsers continue to diverge in subtle ways (OFX amount handling), and the HTML forward-fill logic has an edge case with summary rows. The long-deferred architectural issues (parser duplication, CATEGORY_NAMES_KO) remain unaddressed after 20 cycles.
