# Aggregate Review — Cycle 3

## Summary
Deep review of parser package and web app focusing on format diversity, column/row flexibility, server/web consistency, and test coverage. 10 reviewer perspectives applied. Key finding: Cycles 1-2 successfully improved server-side parsers with ColumnMatcher, adapter-factory, and category-based header detection, but the **web-side bank CSV adapters remain untouched** — still using exact indexOf() for all 10 banks. The user-facing web app has the weakest parsing while the CLI is the most robust.

---

## HIGH SEVERITY FINDINGS

### F-CR-01: Web-side CSV adapters use exact indexOf() for column matching
**Severity: High | Confidence: High | Agents: code-reviewer, architect, tracer, critic**
**File**: `apps/web/src/lib/parser/csv.ts` lines 330-334, 395-399, 461-465, 527-531, 591-595, 656-660, 723-727, 788-792, 854-858, 918-923

All 10 web-side bank CSV adapters use `headers.indexOf('exact string')`. ColumnMatcher is available at `apps/web/src/lib/parser/column-matcher.ts` but unused by bank adapters.

**Cross-agent agreement**: 4 agents flagged this independently.

### F-CR-02: Web-side bank adapter header detection inconsistent and lacks category requirement
**Severity: High | Confidence: High | Agents: code-reviewer, critic**
**File**: `apps/web/src/lib/parser/csv.ts`

Each adapter has different header detection logic. No category-based validation (unlike server-side fixed in cycle 2).

### F-TEST-01: No XLSX parser tests for actual parsing behavior
**Severity: High | Confidence: High | Agents: test-engineer, critic**
**File**: `packages/parser/__tests__/xlsx-parity.test.ts`

Deferred from cycle 2. Zero XLSX parsing tests.

### F-TEST-02: No PDF parser tests
**Severity: High | Confidence: High | Agents: test-engineer, critic**

Deferred from cycle 2. Zero PDF parsing tests.

---

## MEDIUM SEVERITY FINDINGS

### F-ARCH-01: Web-side CSV should use adapter-factory pattern
**Severity: Medium | Confidence: High | Agents: architect, code-reviewer**
**File**: `apps/web/src/lib/parser/csv.ts`

Server-side has createBankAdapter() factory. Web-side has 10 hand-written adapters (~60 lines each).

### F-CR-06: HEADER_KEYWORDS duplicated 4 times
**Severity: Medium | Confidence: High | Agents: code-reviewer, tracer**
**Files**: generic.ts:47, xlsx/index.ts:133, web/csv.ts:158, web/xlsx.ts:369

### F-CR-07: BANK_COLUMN_CONFIGS duplicated 3 times
**Severity: Medium | Confidence: High | Agents: code-reviewer, architect**
**Files**: xlsx/adapters/index.ts, web/xlsx.ts, adapter-factory.ts

### F-CR-03: Server-side XLSX returns first sheet, not best sheet
**Severity: Medium | Confidence: High | Agents: code-reviewer, architect, tracer**
**File**: `packages/parser/src/xlsx/index.ts` lines 117-124

### F-DBG-01: Generic CSV merchant inference picks first column blindly
**Severity: Medium | Confidence: High | Agents: debugger**
**File**: `packages/parser/src/csv/generic.ts` lines 135-142

### F-DBG-02: Server-side XLSX parseDateToISO has no error reporting
**Severity: Medium | Confidence: High | Agents: debugger**
**File**: `packages/parser/src/xlsx/index.ts` lines 38-62

### F-DBG-03: parseDateStringToISO console.warn is noisy
**Severity: Medium | Confidence: High | Agents: debugger**
**File**: `apps/web/src/lib/parser/date-utils.ts` line 140

### F-CR-09: Server-side date parsing has no error reporting unlike web-side
**Severity: Medium | Confidence: High | Agents: code-reviewer**

### F-TEST-04: CSV adapter tests only cover KB and Samsung
**Severity: Medium | Confidence: High | Agents: test-engineer**

### F-PERF-04: Category keyword Sets recreated per call
**Severity: Low | Confidence: Medium | Agents: perf-reviewer**

---

## LOW SEVERITY FINDINGS

### F-PERF-01: Server-side detectFormat reads CSV file twice
### F-CR-08: splitCSVLine only handles RFC 4180 for commas
### F-SEC-01: PDF text extraction has no size limit
### F-DBG-06: Web-side parseAmount strips whitespace, server-side does not
### F-DOC-01: Inconsistent error message language (Korean vs English)
### F-DES-01: Parse error messages language inconsistency

---

## POSITIVE VERIFICATIONS (Cycle 2 fixes confirmed working)

1. Server-side XLSX category-based header detection: VERIFIED
2. ColumnMatcher in server-side XLSX findCol(): VERIFIED
3. BOM stripping consistency: VERIFIED

---

## TOTAL FINDINGS: 18 (4 High, 9 Medium, 5 Low)
## CROSS-AGENT AGREEMENT: F-CR-01 flagged by 4 agents, F-TEST-01/02 by 2 agents each
