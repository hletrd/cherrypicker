# Cycle 14 — Aggregate Review (2026-05-05)

Deduplicated findings across `code-reviewer`, `security-reviewer`, `test-engineer`, `architect`, `debugger`, `critic`, `verifier`, `tracer`, `document-specialist`, `designer`, and `perf-reviewer`.

Provenance files retained at `.context/reviews/c14-<agent-name>.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C14-01 — `isValidISODate` accepts invalid dates like "2024-99-99" (HIGH)
- **Agents:** code-reviewer (HIGH), debugger (HIGH), verifier (FAIL), architect (MEDIUM), critic (HIGH), document-specialist (MEDIUM)
- **Files:** `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242`
- **Consensus:** The regex `/^\d{4}-\d{2}-\d{2}$/` only validates format, not actual month/day ranges. When `parseDateStringToISO` receives unrecognizable input that happens to look ISO-like (e.g., "2024-99-99"), it returns the input as-is. `isValidISODate` then incorrectly returns `true`, causing parsers to accept invalid dates without reporting parse errors. This is a semantic contract violation (function name promises "valid ISO date").

### C14-02 — `console.warn` still present after C11 cleanup (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), security-reviewer (LOW), critic (MEDIUM), designer (LOW)
- **Files:** `apps/web/src/lib/analyzer.ts:58, 64`, `apps/web/src/lib/store.svelte.ts:191, 243, 246, 329, 330, 338, 358`
- **Consensus:** Commit `8fbe12a` (C11) claimed to remove stale console.warn, but multiple instances remain in analyzer.ts and store.svelte.ts. This creates production console noise and leaks internal data (card IDs, field values).

### C14-03 — `renderPageText` hardcoded character width of 6 (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), perf-reviewer (LOW), critic (MEDIUM), tracer (MEDIUM)
- **Files:** `packages/parser/src/pdf/extractor.ts:26`, `apps/web/src/lib/parser/pdf.ts:522`
- **Consensus:** The `lastEndX` calculation uses `item.str.length * 6` as a crude width approximation. Korean and Latin characters have different PDF font widths. Incorrect space insertion can merge adjacent text items, degrading table parsing accuracy.

---

## Verified Fixed (from Cycle 13)

| Finding | File | Evidence | Agents |
|---------|------|----------|--------|
| C13-04: PDF trailing-minus lost | `apps/web/src/lib/parser/pdf.ts:573` | Capture group now includes minus | code-reviewer, verifier, debugger |
| C13-CR01: Double semicolons | `packages/parser/src/csv/adapter-factory.ts` | Removed | code-reviewer, verifier |
| T13-01: No web-side parser tests | `apps/web/__tests__/parser-*.test.ts` | HTML, JSON, OFX, PDF tests added | test-engineer, verifier |
| T13-02: PDF trailing-minus test | `apps/web/__tests__/parser-pdf.test.ts` | Added | test-engineer, verifier |
| T13-03: OFX negative amount test | `apps/web/__tests__/parser-ofx.test.ts` | Added | test-engineer, verifier |
| T13-04: JSON negative amount test | `apps/web/__tests__/parser-json.test.ts` | Added | test-engineer, verifier |

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **HIGH** | Correctness | `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242` | C14-01: `isValidISODate` accepts invalid dates | code-reviewer, debugger, verifier, architect, critic, document-specialist |
| 2 | **MEDIUM** | Code Quality | `apps/web/src/lib/analyzer.ts:58, 64`, `apps/web/src/lib/store.svelte.ts` | C14-02: `console.warn` remains after C11 cleanup | code-reviewer, debugger, security-reviewer, critic, designer |
| 3 | **MEDIUM** | Correctness | `packages/parser/src/pdf/extractor.ts:26`, `apps/web/src/lib/parser/pdf.ts:522` | C14-03: `renderPageText` hardcoded char width | code-reviewer, perf-reviewer, critic, tracer |
| 4 | **MEDIUM** | Testing | `packages/parser/__tests__/date-utils.test.ts`, `apps/web/__tests__/parser-date.test.ts` | C14-TEST-01: No test for `isValidISODate` invalid dates | test-engineer |
| 5 | **MEDIUM** | Architecture | `packages/parser/src/`, `apps/web/src/lib/parser/` | C14-ARCH01: Parser duplication (web vs server) | architect, critic |
| 6 | **MEDIUM** | Code Quality | `packages/parser/src/date-utils.ts:104`, `apps/web/src/lib/parser/date-utils.ts:80` | C14-05: `parseDateStringToISO` fullMatch lacks end anchor | code-reviewer |
| 7 | **MEDIUM** | Correctness | `apps/web/src/lib/analyzer.ts:58, 64` | C14-DB03: Fallback values bypass type safety | debugger |
| 8 | **LOW** | Code Quality | `packages/parser/src/csv/adapter-factory.ts:8-9` | C14-04: Duplicate import paths | code-reviewer |
| 9 | **LOW** | Testing | `packages/parser/__tests__/csv-shared.test.ts` | C14-TEST-02: No test for `parseAmountString` multi-decimal | test-engineer |
| 10 | **LOW** | Docs | `packages/parser/src/pdf/index.ts:317-318` | C14-DS01: Missing capture group comments | document-specialist |
| 11 | **LOW** | Security | `packages/parser/src/csv/shared.ts:140-163` | C14-SEC02: Potential ReDoS on long inputs | security-reviewer |
| 12 | **LOW** | UI/UX | `apps/web/src/lib/analyzer.ts:58, 64` | C14-UI02: console.warn may confuse users | designer |

---

## Carry-overs from Previous Cycles

### MEDIUM-priority carry-overs
- **D-01** — Parser duplication (web vs packages). HIGH. Major refactor deferred.
- **D7-M13** — CSP `unsafe-inline` in script-src. MEDIUM.
- **C12-04** — `isDateLike` doesn't allow spaces around delimiters. Low-Medium.
- **C12-05** — Web XLSX BANK_COLUMN_CONFIGS duplication. LOW.

### LOW-priority carry-overs
- D-09, D7-M5, D7-M9, C9-02 through C9-10, D8-02, C12-UX01 through C12-UX04, D-02

---

## Agent Failures

None. All review perspectives completed successfully.

---

## Recommended Priority Order

1. **C14-01** — Fix `isValidISODate` to validate month/day ranges (HIGH)
2. **C14-02** — Remove remaining `console.warn` calls (MEDIUM)
3. **C14-TEST-01** — Add tests for `isValidISODate` invalid dates (MEDIUM)
4. **C14-03** — Improve `renderPageText` width estimation (MEDIUM)
5. **C14-ARCH01** — Address parser duplication (MEDIUM, deferred)
6. **C14-05** — Add end anchor to fullMatch regex (MEDIUM)
7. **C14-DB03** — Review fallback normalization behavior (MEDIUM)
8. **C14-04** — Combine duplicate imports (LOW)

**Overall Verdict:** Cycle 14 has 1 HIGH and 6 MEDIUM actionable findings. Priority should go to C14-01 (`isValidISODate` bug) which can silently corrupt date data.
