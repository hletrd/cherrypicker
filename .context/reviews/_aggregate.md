# Cycle 12 — Aggregate Review (2026-05-05)

Deduplicated findings across `code-reviewer`, `perf-reviewer`, `security-reviewer`, `architect`, `test-engineer`, `designer`, `debugger`, `critic`, `verifier`, `tracer`, and `document-specialist`.

Provenance files retained at `.context/reviews/c12-<agent-name>.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C12-01 — Date error reporting gap in adapter-factory (HIGH)
- **Agents:** code-reviewer (HIGH), verifier (FAIL), architect (recommendation)
- **File:** `packages/parser/src/csv/adapter-factory.ts:129`
- **Consensus:** The adapter factory calls `parseDateStringToISO()` without passing `errors` and `lineIdx`, so unparseable dates are silently returned as raw strings. The generic CSV parser DOES report date errors via `isValidISODate()`. This is a genuine data-loss bug affecting all 10 bank-specific adapters.

### C12-02 / C12-03 — Column-matcher gaps (MEDIUM + HIGH)
- **Agents:** code-reviewer (Medium), test-engineer (HIGH), verifier (FAIL)
- **Files:** `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/xlsx.ts:423-430`
- **Consensus:** Two related issues: (1) column-matcher module has zero dedicated test coverage despite being core infrastructure, and (2) web XLSX parser uses a local `findCol()` closure instead of importing the shared `findColumn`. Both represent maintainability and correctness risks.

### C12-04 — CSV isDateLike whitespace tolerance (Low-Medium)
- **Agents:** code-reviewer (Low-Medium)
- **Files:** `packages/parser/src/csv/generic.ts:19-26`, `apps/web/src/lib/parser/csv.ts:121`
- **Description:** `isDateLike()` patterns don't allow spaces around delimiters, but `parseDateStringToISO()` does. A cell like "2024 - 01 - 15" would parse correctly but NOT be detected as a date column by inference.

### C12-06 — Adapter-factory missing date validation (Medium)
- **Agents:** code-reviewer (Medium), verifier (FAIL)
- **File:** `packages/parser/src/csv/adapter-factory.ts:129`
- **Description:** Unlike generic CSV and all other parsers, the adapter-factory path does not call `isValidISODate()` after parsing. Malformed dates could propagate downstream.

### C12-DB03 — PDF fallback date match group indexing (LOW)
- **Agents:** debugger (LOW)
- **File:** `apps/web/src/lib/parser/pdf.ts:356-391`
- **Description:** Fallback line scanner uses `dateMatch[1]` but the pattern has no capture groups, so `dateMatch[1]` is `undefined`. `parseDateToISO` receives `undefined` → "undefined" string. Downstream filtering prevents user-visible bug, but this is a latent defect.

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **HIGH** | Correctness | `packages/parser/src/csv/adapter-factory.ts:129` | C12-01: Silent swallow of unparseable dates in adapter-factory | code-reviewer, verifier, architect |
| 2 | **HIGH** | Testing | `packages/parser/src/csv/column-matcher.ts` | T12-01: Zero dedicated test coverage for column-matcher | test-engineer, code-reviewer |
| 3 | **MEDIUM** | Code Quality | `apps/web/src/lib/parser/xlsx.ts:423-430` | C12-02: Web XLSX uses local findCol instead of shared findColumn | code-reviewer, verifier |
| 4 | **MEDIUM** | Correctness | `packages/parser/src/csv/adapter-factory.ts:129` | C12-06: Adapter-factory missing isValidISODate after parse | code-reviewer, verifier |
| 5 | **MEDIUM** | Testing | `packages/parser/src/csv/generic.ts:19-44` | T12-02: No tests for isDateLike/isAmountLike heuristics | test-engineer |
| 6 | **Low-Medium** | Format Diversity | `packages/parser/src/csv/generic.ts:19-26` | C12-04: isDateLike doesn't allow spaces around delimiters | code-reviewer |
| 7 | **LOW** | Latent Bug | `apps/web/src/lib/parser/pdf.ts:356-391` | C12-DB03: PDF fallback dateMatch[1] used without capture groups | debugger |
| 8 | **LOW** | Testing | `packages/parser/src/xlsx/` | T12-03: No test for XLSX formula error cells | test-engineer |
| 9 | **LOW** | Testing | `packages/parser/src/pdf/` | T12-04: No test for PDF multi-line cell content | test-engineer |
| 10 | **LOW** | UX | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:203-275` | C12-UX01: Hover expansion not discoverable on mobile | designer |
| 11 | **LOW** | UX | `apps/web/src/components/dashboard/SpendingSummary.svelte:158` | C12-UX02: Dismiss button lacks visible focus ring | designer |
| 12 | **LOW** | UX | `apps/web/src/components/dashboard/TransactionReview.svelte:272` | C12-UX04: Table horizontal scroll without indicator | designer |
| 13 | **LOW** | Docs | `README.md:169-171` vs `LICENSE:1-15` | C12-DS01: README says MIT, LICENSE is Apache 2.0 (deferred D-02) | document-specialist |

---

## Carry-overs from Previous Cycles (severity preserved)

### MEDIUM-priority carry-overs
- **D7-M13** — CSP `unsafe-inline` in script-src. MEDIUM. Requires Astro nonce upstream support.
- **D-01** — Parser duplication (web vs packages). HIGH. Major refactor deferred.
- **D7-M11** — Architectural refactors (A7-01/02/03). MEDIUM. Cross-cycle.

### LOW-priority carry-overs
- **D-09** — `scoreCardsForTransaction` O(n*m) performance. LOW.
- **D7-M5** — Silent drop of malformed-date rows in monthlyBreakdown. LOW.
- **D7-M9** — `ui-ux-screenshots.spec.js` has no assertions. LOW. Intentional.
- **C9-02** — ALL_BANKS duplicates parser bank signatures. LOW.
- **C9-03** — formatIssuerNameKo duplicates issuer name data. LOW.
- **C9-04** — getIssuerColor duplicates issuer color data. LOW.
- **C9-05** — getCategoryIconName duplicates taxonomy icon mapping. LOW.
- **D8-02** — Dashboard cards lack `role="region"` + `aria-labelledby`. LOW.
- **C9-08** — No test coverage for buildCategoryLabelMap edge cases. LOW.
- **C9-09** — No test coverage for sessionStorage persistence/recovery. LOW.
- **C9-10** — build-stats.ts fallback values may become stale. LOW.

---

## Agent Failures
None. All 11 agents completed successfully.

---

## Recommended Priority Order
1. **C12-01** — Fix adapter-factory date error reporting (HIGH)
2. **C12-06** — Add isValidISODate validation to adapter-factory (MEDIUM)
3. **T12-01** — Add dedicated column-matcher tests (HIGH)
4. **C12-02** — Align web XLSX with shared findColumn (MEDIUM)
5. **T12-02** — Add isDateLike/isAmountLike heuristic tests (MEDIUM)
6. **C12-04** — Allow spaces in isDateLike patterns (Low-Medium)
7. **C12-DB03** — Fix PDF fallback dateMatch group indexing (LOW)
8. **T12-03** — Add XLSX formula error cell tests (LOW)
9. **T12-04** — Add PDF multi-line cell tests (LOW)
10. **C12-UX01/02/04** — UX polish items (LOW)

**Overall Verdict:** Cycle 12 has 2 HIGH and 4 MEDIUM actionable findings. The codebase remains solid with no security or performance regressions. Priority should go to C12-01 (date error reporting) and T12-01 (column-matcher tests).
