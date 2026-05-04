# Aggregate Review — Cycle 1

## Summary
Deep review of the cherrypicker parser package focusing on format diversity, column/row flexibility, and robustness. 10 reviewer perspectives applied. Key finding: the parser architecture is sound (adapter pattern with generic fallback) but the implementation is brittle due to exact string matching, massive code duplication, and significant divergence between server-side and web-side implementations.

---

## HIGH SEVERITY FINDINGS

### F-01: Server-side generic CSV parser header detection fails on metadata-heavy files
**Confidence: High | Agents: code-reviewer, debugger, verifier, tracer, critic**
**Files**: `packages/parser/src/csv/generic.ts` lines 43-49

Server-side scans only 5 lines and accepts ANY Korean text as a header indicator. Web-side scans 30 lines and requires header keywords from 2+ categories. Korean bank CSV exports commonly have 5-15 lines of metadata before the header.

**Cross-agent agreement**: 5 agents flagged this independently.

### F-02: All 10 bank CSV adapters use exact `indexOf()` for column matching — brittle
**Confidence: High | Agents: code-reviewer, verifier, tracer, critic**
**Files**: `packages/parser/src/csv/*.ts`, `apps/web/src/lib/parser/csv.ts`

Every adapter uses `headers.indexOf('exact string')`. If a bank changes column names even slightly, the parser silently fails. The XLSX parser already has the correct approach (regex-based `findCol()`).

**Cross-agent agreement**: 4 agents flagged this independently.

### F-03: Massive code duplication — 10 bank adapters x 2 (server + web) = 20 near-identical files
**Confidence: High | Agents: code-reviewer, architect, critic**
**Files**: `packages/parser/src/csv/*.ts`, `apps/web/src/lib/parser/csv.ts`

All 10 bank adapters follow an identical template. The only differences are header names and detect patterns. The web-side reimplements all 10 adapters. Any fix must be applied 20 times.

**Cross-agent agreement**: 3 agents flagged this independently.

### F-04: Server-side generic CSV parser has weaker column detection than web-side
**Confidence: High | Agents: code-reviewer, verifier**
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`

Missing header keyword categories, fewer date patterns, no BOM stripping, shorter scan depth.

---

## MEDIUM SEVERITY FINDINGS

### F-05: Server-side CSV entry point missing BOM stripping
**Confidence: High | Agents: code-reviewer, verifier**
**Files**: `packages/parser/src/csv/index.ts`, `packages/parser/src/index.ts`

Web-side strips BOM at line 969. Server-side does not. Windows-generated CSV exports commonly include BOM.

### F-06: No test fixtures for any bank-specific CSV format (except KB and Samsung)
**Confidence: High | Agents: test-engineer**
**Files**: `packages/parser/__tests__/`

10 bank adapters are completely untested. No XLSX or PDF parser tests exist.

### F-07: XLSX column configs are separate from CSV column configs
**Confidence: High | Agents: architect**
**Files**: `packages/parser/src/xlsx/adapters/index.ts`, `packages/parser/src/csv/*.ts`

XLSX has a centralized `BANK_COLUMN_CONFIGS` for all 24 banks. CSV has hardcoded configs in 10 separate files.

### F-08: Generic CSV merchant column inference picks first non-date/non-amount column
**Confidence: High | Agents: code-reviewer, debugger**
**Files**: `packages/parser/src/csv/generic.ts` lines 85-93

If installments or category columns come before the merchant column, they'll be misidentified as merchant.

### F-09: Bank adapter `detect()` methods duplicate patterns from `detect.ts`
**Confidence: High | Agents: code-reviewer**
**Files**: `packages/parser/src/csv/*.ts`, `packages/parser/src/detect.ts`

Each adapter has its own copy of bank detection patterns, duplicating the central `BANK_SIGNATURES`.

### F-10: No PDF parser tests
**Confidence: High | Agents: test-engineer**
**Files**: `packages/parser/__tests__/`

3-tier PDF parsing (structured, fallback, LLM) is completely untested.

### F-11: Web-side amount column regex includes '합계' (summary column)
**Confidence: Medium | Agents: code-reviewer**
**Files**: `apps/web/src/lib/parser/csv.ts` line 210

'합계' (total/sum) could be matched as an amount column header instead of being skipped.

### F-12: Parse errors lack actionable guidance for users
**Confidence: Medium | Agents: critic, designer**
**Files**: All parser error paths

Error messages are technical Korean strings with no recovery suggestions.

---

## LOW SEVERITY FINDINGS

### F-13: `detectCSVDelimiter` doesn't support semicolons
**Confidence: Medium | Agents: code-reviewer**

### F-14: PDF `findAmountCell` could match page numbers or reference numbers
**Confidence: Medium | Agents: debugger**

### F-15: `inferYear()` uses server local time, not user timezone
**Confidence: Medium | Agents: debugger**

### F-16: No documentation for adding new bank adapters
**Confidence: High | Agents: document-specialist**

### F-17: Referenced D-01 refactor doesn't exist
**Confidence: High | Agents: document-specialist**

### F-18: `BankAdapter` interface has no `parsePDF` method
**Confidence: High | Agents: architect**

### F-19: 14 of 24 banks have no CSV adapters
**Confidence: Low | Agents: architect**

### F-20: No statement period extraction from parsed data
**Confidence: Low | Agents: critic**

---

## DEFERRED ITEMS
None — all findings are addressed in the implementation plan.

---

## AGENT FAILURES
All 11 requested agents (code-reviewer, perf-reviewer, security-reviewer, critic, verifier, test-engineer, tracer, architect, debugger, document-specialist, designer) completed successfully. The custom perf-reviewer agent file at `.claude/agents/perf-reviewer.md` was not available for direct invocation but the performance review was conducted inline.