# Cycle 13 — Aggregate Review (2026-05-05)

Deduplicated findings across `code-reviewer`, `security-reviewer`, `test-engineer`, `architect`, `debugger`, `critic`, `verifier`, `tracer`, `document-specialist`, `designer`, and `perf-reviewer`.

Provenance files retained at `.context/reviews/c13-<agent-name>.md`.

---

## Cross-Agent Agreement (High-Signal Findings)

### C13-04 — PDF fallback trailing-minus amounts parsed as positive (MEDIUM)
- **Agents:** code-reviewer (MEDIUM), debugger (MEDIUM), verifier (FAIL), tracer (MEDIUM)
- **File:** `apps/web/src/lib/parser/pdf.ts:565, 604`
- **Consensus:** The `fallbackAmountPattern` group 6 `([\d,]*(?:,|\d{5,})[\d,]*)-` places the trailing `-` OUTSIDE the capture group. `amountMatch[6]` gets only the digits (e.g., `"1,234"`). `parseAmount()` then loses the negativity because its trailing-minus detection (`/\d-$/`) requires the minus to be present. The result: a refund amount is treated as positive spending. The structured table parsing path is unaffected.

### T13-01 — No web-side tests for HTML, OFX, JSON parsers (MEDIUM)
- **Agents:** test-engineer (MEDIUM), critic (MEDIUM), verifier (GAP)
- **Files:** `apps/web/__tests__/`
- **Consensus:** Web-side test directory contains only 4 files: `analyzer-adapter.test.ts`, `formatters.test.ts`, `parser-date.test.ts`, `parser-encoding.test.ts`. Missing: `parser-html.test.ts`, `parser-ofx.test.ts`, `parser-json.test.ts`, `parser-xlsx.test.ts`, `parser-pdf.test.ts`, `parser-csv.test.ts`. Server-side has tests for all 7 formats. The web-side parsers are hand-maintained duplicates (D-01) and are at high risk of divergence.

---

## Verified Fixed (from Cycle 12)

| Finding | File | Evidence | Agents |
|---------|------|----------|--------|
| C12-01: Silent swallow of unparseable dates | `packages/parser/src/csv/adapter-factory.ts:158-160` | Now validates with `isValidISODate` and reports `ParseError` | code-reviewer, verifier, architect |
| C12-06: Adapter-factory missing isValidISODate | `packages/parser/src/csv/adapter-factory.ts:158-160` | Same fix as C12-01 | code-reviewer, verifier |
| C12-02: Web XLSX local findCol | `apps/web/src/lib/parser/xlsx.ts:7` | Now imports `findColumn` from `./column-matcher.js` | code-reviewer, verifier |
| T12-01: Zero column-matcher tests | `packages/parser/__tests__/column-matcher.test.ts` | 2548 lines, 1408+ tests | test-engineer, code-reviewer |

---

## Retracted Findings

| Finding | Reason |
|---------|--------|
| C12-DB03: PDF fallback `dateMatch[1]` undefined | **FALSE POSITIVE.** The `fallbackDatePattern` at `apps/web/src/lib/parser/pdf.ts:554` HAS an outer capture group. `dateMatch[1]` is valid. |

---

## Deduplicated Findings (Highest Severity Preserved)

| # | Severity | Category | File | Finding | Agents |
|---|----------|----------|------|---------|--------|
| 1 | **MEDIUM** | Correctness | `apps/web/src/lib/parser/pdf.ts:565` | C13-04: PDF fallback trailing-minus lost in capture group | code-reviewer, debugger, verifier, tracer |
| 2 | **MEDIUM** | Testing | `apps/web/__tests__/` | T13-01: No web-side HTML/OFX/JSON parser tests | test-engineer, critic, verifier |
| 3 | **MEDIUM** | Testing | `apps/web/src/lib/parser/pdf.ts:565` | T13-02: No test for PDF fallback trailing-minus bug | test-engineer |
| 4 | **LOW** | Code Quality | `packages/parser/src/csv/adapter-factory.ts:7`, `generic.ts:2` | C13-CR01: Double semicolon syntax debris | code-reviewer |
| 5 | **LOW** | Testing | `apps/web/src/lib/parser/ofx.ts:134-135` | T13-03: No test for OFX negative amount conversion | test-engineer |
| 6 | **LOW** | Testing | `apps/web/src/lib/parser/json.ts:98-100` | T13-04: No test for JSON negative amount preservation | test-engineer |
| 7 | **LOW** | Docs | `apps/web/src/lib/parser/pdf.ts:560-565` | C13-DS01: PDF fallback amount pattern lacks capture-group docs | document-specialist |

---

## Carry-overs from Previous Cycles (severity preserved)

### MEDIUM-priority carry-overs
- **D7-M13** — CSP `unsafe-inline` in script-src. MEDIUM. Requires Astro nonce upstream support.
- **D-01** — Parser duplication (web vs packages). HIGH. Major refactor deferred.
- **D7-M11** — Architectural refactors (A7-01/02/03). MEDIUM. Cross-cycle.
- **C12-04** — `isDateLike` doesn't allow spaces around delimiters. Low-Medium.
- **C12-05** — Web XLSX BANK_COLUMN_CONFIGS duplication. LOW.

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
- **C12-UX01** — Hover expansion not discoverable on mobile. LOW.
- **C12-UX02** — Dismiss button lacks visible focus ring. LOW.
- **C12-UX04** — Table horizontal scroll without indicator. LOW.
- **D-02** — README MIT vs LICENSE Apache 2.0 mismatch. MEDIUM (deferred).

---

## Agent Failures

None. All 11 agents completed successfully.

---

## Recommended Priority Order

1. **C13-04** — Fix PDF fallback trailing-minus capture group (MEDIUM)
2. **T13-01** — Add web-side parser tests for HTML, OFX, JSON (MEDIUM)
3. **T13-02** — Add test for PDF fallback trailing-minus (MEDIUM)
4. **C13-CR01** — Remove double semicolon syntax debris (LOW)
5. **T13-03** — Add test for OFX negative amount conversion (LOW)
6. **T13-04** — Add test for JSON negative amount preservation (LOW)
7. **C13-DS01** — Document PDF fallback amount pattern capture groups (LOW)
8. **C12-04** — Allow spaces in isDateLike patterns (Low-Medium — deferred)

**Overall Verdict:** Cycle 13 has 3 MEDIUM and 6 LOW actionable findings. The codebase remains solid with no security or performance regressions. Priority should go to C13-04 (PDF trailing-minus bug) and T13-01 (web-side parser tests).
