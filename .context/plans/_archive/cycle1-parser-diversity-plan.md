# Cycle 1 Plan: Parser Format Diversity Improvements

## Goal
Make the parser handle more diverse file formats, column orderings, and naming conventions for Korean credit card statements.

## Status: IN PROGRESS (Phase 1-4 complete, Phase 5 partial)

---

## Phase 1: Fix Server-Side Generic CSV Parser (Critical) -- DONE

### Task 1.1: Port web-side header detection improvements to server-side generic CSV parser -- DONE
**Findings**: F-01, F-04
**Files**: `packages/parser/src/csv/generic.ts`

### Task 1.2: Add BOM stripping to server-side CSV entry point -- DONE
**Finding**: F-05
**Files**: `packages/parser/src/csv/index.ts`

---

## Phase 2: Flexible Column Matching (Critical) -- DONE

### Task 2.1: Create shared `ColumnMatcher` utility -- DONE
**Findings**: F-02, F-08
**New file**: `packages/parser/src/csv/column-matcher.ts`

### Task 2.2: Refactor bank-specific CSV adapters to use ColumnMatcher -- DONE
**Findings**: F-02, F-03, F-09
**Files**: `packages/parser/src/csv/adapter-factory.ts` (new), `packages/parser/src/csv/index.ts`

### Task 2.3: Refactor web-side bank adapters to use same ColumnMatcher -- DEFERRED
**Findings**: F-02, F-03
**Files**: `apps/web/src/lib/parser/csv.ts`
**Reason**: Web-side adapters are browser-only, need separate ColumnMatcher copy. Deferred to next cycle.

---

## Phase 3: Consolidate Bank Adapter Config (High) -- PARTIAL

### Task 3.1: Create shared bank adapter config module -- DEFERRED
**Findings**: F-03, F-07, F-09
**Reason**: Merging CSV and XLSX configs into a single module requires updating XLSX parser imports. Deferred to next cycle.

### Task 3.2: Create configurable CSV adapter factory -- DONE
**Finding**: F-03
**New file**: `packages/parser/src/csv/adapter-factory.ts`

---

## Phase 4: Add Test Fixtures and Coverage (High) -- DONE

### Task 4.1: Create CSV test fixtures for all 10 banks -- DONE
**Finding**: F-06
**New files**: fixtures for hyundai, ibk, woori, lotte, hana, nh, plus BOM and metadata-heavy

### Task 4.2: Add CSV adapter parsing tests -- DONE
**Finding**: F-06
**New file**: `packages/parser/__tests__/csv-adapters.test.ts`

### Task 4.3: Add generic parser resilience tests -- DONE
**Finding**: F-06
**Tests**: metadata-heavy, BOM, reordered columns, semicolons, extra columns, summary rows

### Task 4.4: Add XLSX parser tests -- DEFERRED
**Finding**: F-10
**Reason**: Requires creating XLSX binary fixtures. Deferred to next cycle.

---

## Phase 5: Polish and Documentation (Medium) -- PARTIAL

### Task 5.1: Fix web-side amount column regex (remove '합계') -- DONE
**Finding**: F-11
**Files**: `apps/web/src/lib/parser/csv.ts`

### Task 5.2: Add semicolon to delimiter detection -- DONE
**Finding**: F-13
**Files**: `packages/parser/src/detect.ts`, `apps/web/src/lib/parser/detect.ts`

### Task 5.3: Add '승인일자' to generic parser date column regex -- DONE
**Finding**: tracer C1-TR-05
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`

### Task 5.4: Document bank adapter extension process -- DEFERRED
**Finding**: F-16
**Reason**: Documentation task, deferred to next cycle.

---

## DEFERRED ITEMS

### D-01: Full server/web shared module refactor
**Findings**: F-03 (partial), F-17
**Reason**: Out of scope for this cycle. Requires new `packages/parser-common/` package with build config for both Bun and browser. Significant infrastructure work.
**Exit criterion**: When a shared TypeScript package with dual runtime support is set up.

### D-02: Add `parsePDF` to BankAdapter interface
**Finding**: F-18
**Reason**: Requires designing bank-specific PDF parsing strategies, which is a separate feature.
**Exit criterion**: When bank-specific PDF parsing strategies are implemented.

### D-03: Add CSV adapters for remaining 14 banks
**Finding**: F-19
**Reason**: Low priority — generic parser handles these. Would benefit from real export samples first.
**Exit criterion**: When real export samples from these banks are available.

### D-04: Statement period extraction
**Finding**: F-20
**Reason**: Nice-to-have, not related to format diversity.
**Exit criterion**: When optimizer needs statement period for time-scoped analysis.

### D-05: PDF amount cell false positive mitigation
**Finding**: F-14
**Reason**: Low risk — the structured parser already validates date+amount presence in the same row.
**Exit criterion**: When PDF parsing accuracy issues are reported by users.

### D-06: Timezone-aware year inference
**Finding**: F-15
**Reason**: Low impact — 3-month window provides sufficient tolerance.
**Exit criterion**: When multi-timezone support is added.

### D-07: File size limits for DoS prevention
**Finding**: security F-01
**Reason**: Local CLI tool — user controls their own files. Web app should add limits separately.
**Exit criterion**: When the web app accepts untrusted file uploads at scale.

### D-08: Actionable parse error messages with recovery guidance
**Finding**: F-12
**Reason**: UX improvement, not a parser correctness issue.
**Exit criterion**: When user-facing error handling is redesigned.

### D-09: No input size limits (security)
**Finding**: security F-01
**Reason**: Local tool, user controls input.
**Exit criterion**: When web deployment handles untrusted uploads.

---

## IMPLEMENTATION ORDER
1. Phase 1 (Tasks 1.1, 1.2) — Fix critical server-side parser weaknesses
2. Phase 2 (Tasks 2.1, 2.2) — Flexible column matching
3. Phase 4 (Tasks 4.1, 4.2, 4.3) — Add test coverage for existing + new behavior
4. Phase 3 (Tasks 3.1, 3.2) — Consolidate adapter config (depends on Phase 2)
5. Phase 5 (Tasks 5.1-5.4) — Polish