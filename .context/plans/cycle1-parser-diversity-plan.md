# Cycle 1 Plan: Parser Format Diversity Improvements

## Goal
Make the parser handle more diverse file formats, column orderings, and naming conventions for Korean credit card statements.

## Status: IN PROGRESS

---

## Phase 1: Fix Server-Side Generic CSV Parser (Critical)

### Task 1.1: Port web-side header detection improvements to server-side generic CSV parser
**Findings**: F-01, F-04
**Files**: `packages/parser/src/csv/generic.ts`
**Changes**:
- Increase header scan depth from 5 to 30 lines
- Add keyword category validation (require keywords from 2+ categories)
- Add full HEADER_KEYWORDS list matching web-side
- Add DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS sets
- Add all missing header regex patterns (결제일, 승인일, 매출일, 거래처, 매출처, 사용처, 결제처, 상호, 결제금액, 승인금액, 매출금액, 이용액, 할부개월, 할부기간, 할부월, 업종분류, 업종명, 적요, 내용, 설명, 참고)

### Task 1.2: Add BOM stripping to server-side CSV entry point
**Finding**: F-05
**Files**: `packages/parser/src/csv/index.ts`
**Changes**: Add `content.replace(/^﻿/, '')` before passing to adapters

---

## Phase 2: Flexible Column Matching (Critical)

### Task 2.1: Create shared `ColumnMatcher` utility
**Findings**: F-02, F-08
**New file**: `packages/parser/src/csv/column-matcher.ts`
**Changes**:
- Create a `findColumn(headers, exactName, pattern)` function that:
  1. Tries exact match first (trimmed)
  2. Tries regex pattern match
  3. Returns column index or -1
- Create a `normalizeHeader(h)` function that trims and collapses whitespace
- Export reusable column pattern constants for date, merchant, amount, installments, category, memo

### Task 2.2: Refactor bank-specific CSV adapters to use ColumnMatcher
**Findings**: F-02, F-03, F-09
**Files**: All `packages/parser/src/csv/*.ts` adapters
**Changes**: Replace `headers.indexOf('exact')` with `findColumn(headers, 'exact', /pattern/)`. Use shared column patterns from the XLSX adapter index.

### Task 2.3: Refactor web-side bank adapters to use same ColumnMatcher
**Findings**: F-02, F-03
**Files**: `apps/web/src/lib/parser/csv.ts`
**Changes**: Port ColumnMatcher to web-side (or create shared package), refactor all web-side adapters

---

## Phase 3: Consolidate Bank Adapter Config (High)

### Task 3.1: Create shared bank adapter config module
**Findings**: F-03, F-07, F-09
**New file**: `packages/parser/src/bank-config.ts`
**Changes**:
- Merge CSV adapter configs and XLSX column configs into a single `BankConfig` per bank
- Each config includes: bankId, detectPatterns, csvHeaders (exact + regex), xlsxColumnConfig
- Both CSV and XLSX parsers reference this single config

### Task 3.2: Create configurable CSV adapter factory
**Finding**: F-03
**New file**: `packages/parser/src/csv/adapter-factory.ts`
**Changes**:
- `createBankAdapter(config: BankConfig): BankAdapter` function
- Eliminates 10 near-identical adapter files
- Each bank becomes a thin config object

---

## Phase 4: Add Test Fixtures and Coverage (High)

### Task 4.1: Create CSV test fixtures for all 10 banks
**Finding**: F-06
**New files**: `packages/parser/__tests__/fixtures/sample-{bank}.csv`
**Changes**: Create minimal (3-5 row) CSV fixtures for each bank with realistic headers and data

### Task 4.2: Add CSV adapter parsing tests
**Finding**: F-06
**New file**: `packages/parser/__tests__/csv-adapters.test.ts`
**Changes**: Test each bank adapter against its fixture, verify correct transaction extraction

### Task 4.3: Add generic parser resilience tests
**Finding**: F-06
**New file**: `packages/parser/__tests__/generic-csv.test.ts`
**Changes**: Test with non-standard headers, reordered columns, metadata-heavy files, BOM files

### Task 4.4: Add XLSX parser tests
**Finding**: F-10
**New file**: `packages/parser/__tests__/xlsx.test.ts`
**Changes**: Test HTML-as-XLS detection, serial date parsing, header keyword matching

---

## Phase 5: Polish and Documentation (Medium)

### Task 5.1: Fix web-side amount column regex (remove '합계')
**Finding**: F-11
**Files**: `apps/web/src/lib/parser/csv.ts`

### Task 5.2: Add semicolon to delimiter detection
**Finding**: F-13
**Files**: `packages/parser/src/detect.ts`, `apps/web/src/lib/parser/detect.ts`

### Task 5.3: Add '승인일자' to generic parser date column regex
**Finding**: tracer C1-TR-05
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`

### Task 5.4: Document bank adapter extension process
**Finding**: F-16
**Files**: `packages/parser/README.md` (new) or `AGENTS.md`

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