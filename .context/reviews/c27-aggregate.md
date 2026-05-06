# Cycle 27 — Aggregate Review (2026-05-06)

Deduplicated findings across code-reviewer, debugger, test-engineer, security-reviewer, architect, and verifier.

---

## Cross-Agent Agreement (High-Signal Findings)

### C27-AGREED-01 — XLSX parsers (server + web) missing forward-fill reset on summary rows (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (HIGH)
- **Consensus:** Both server XLSX (`packages/parser/src/xlsx/index.ts:325`) and web XLSX (`apps/web/src/lib/parser/xlsx.ts:484`) skip summary rows via `continue` without resetting forward-fill tracking variables (`lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount`). The HTML parsers (both server and web) received this fix in previous cycles (C25-COR01, C20-04). The XLSX parsers share identical forward-fill logic but were never audited.
- **Files:** `packages/parser/src/xlsx/index.ts:325`, `apps/web/src/lib/parser/xlsx.ts:484`
- **Fix:** Reset all six `last*` variables to `''` before `continue`, matching the HTML parser fix pattern.

### C27-AGREED-02 — Web-side parseAmount duplicated between csv.ts and pdf.ts (LOW)
- **Agents:** code-reviewer (LOW), architect (LOW), verifier (HIGH)
- **Consensus:** `apps/web/src/lib/parser/csv.ts:123-151` and `apps/web/src/lib/parser/pdf.ts:246-274` define ~95% identical `parseAmount` logic (full-width digits, Won signs, 마이너스, trailing minus, parentheses, rounding). The functions differ only in export keyword and comments.
- **Fix:** Extract shared `parseAmount` to `apps/web/src/lib/parser/amount.ts`, import from there in csv.ts and pdf.ts.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `packages/parser/src/xlsx/index.ts:325` | C27-COR01: XLSX forward-fill not reset on summary rows | code-reviewer, debugger, verifier |
| 2 | **MEDIUM** | Correctness | `apps/web/src/lib/parser/xlsx.ts:484` | C27-COR02: Web XLSX forward-fill not reset on summary rows | code-reviewer, debugger, verifier |
| 3 | **LOW** | Correctness | `apps/web/src/lib/parser/csv.ts:123-151` vs `pdf.ts:246-274` | C27-COR03: Duplicate parseAmount | code-reviewer, architect, verifier |
| 4 | **LOW** | Architecture | `apps/web/src/lib/parser/xlsx.ts:5` | C27-ARCH01: XLSX imports normalizeHTML from HTML | code-reviewer, architect |
| 5 | **LOW** | Testing | `packages/parser/__tests__/xlsx.test.ts` | C27-TEST01: No XLSX summary-row forward-fill tests | test-engineer |
| 6 | **LOW** | Testing | `apps/web/__tests__/` | C27-TEST02: No web XLSX tests at all | test-engineer |
| 7 | **LOW** | Security | `apps/web/src/lib/parser/xlsx.ts:5` | C27-SEC01: XLSX coupled to HTML sanitizer | security-reviewer |
| 8 | **LOW** | Security | `packages/parser/src/ofx/index.ts:65-76` | C27-SEC02: OFX regex lacks try/catch defense | security-reviewer |

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

1. **C27-COR01** — Reset forward-fill in server XLSX parser on summary rows (MEDIUM)
2. **C27-COR02** — Reset forward-fill in web XLSX parser on summary rows (MEDIUM)
3. **C27-COR03** — Extract shared parseAmount in web parsers (LOW)
4. **C27-TEST01** — Add server XLSX summary-row forward-fill test (LOW)
5. **C27-ARCH01** — Decouple normalizeHTML from HTML module (LOW, optional)
6. **C27-SEC02** — Add try/catch to OFX regex construction (LOW, optional)

**Overall Verdict:** Cycle 27 has 2 MEDIUM and 6 LOW actionable findings. The dominant theme is parity: XLSX parsers missed the forward-fill fix that HTML parsers received. All findings are fixable within this cycle.
