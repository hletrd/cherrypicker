# Aggregate Review — Cycle 2

## Summary
Deep review of the cherrypicker parser package and web app focusing on format diversity, column/row flexibility, and robustness. 10 reviewer perspectives applied. Key finding: Cycle 1 successfully improved the server-side CSV parser with ColumnMatcher and adapter-factory, but these improvements were NOT propagated to: (1) the server-side XLSX parser, (2) the web-side CSV adapters, (3) the web-side XLSX parser. The server-side XLSX parser has a critical header-detection gap (no category requirement). Test coverage for XLSX and PDF parsing is zero.

---

## HIGH SEVERITY FINDINGS

### F-DBG-01: Server-side XLSX parser header detection lacks category requirement
**Severity: High | Confidence: High | Agents: debugger, code-reviewer, tracer**
**File**: `packages/parser/src/xlsx/index.ts` lines 161-169

The server-side XLSX parser only checks `matchCount >= 2` for header detection. It does NOT require keywords from 2+ distinct categories (date, merchant, amount). The web-side XLSX parser and both generic CSV parsers require this. A summary row with two amount-related keywords ('이용금액', '승인금액') would be misidentified as the header, causing all subsequent rows to be parsed incorrectly.

**Cross-agent agreement**: 3 agents flagged this independently.

### F-TEST-01: No XLSX parser tests for actual parsing behavior
**Severity: High | Confidence: High | Agents: test-engineer, critic**
**File**: `packages/parser/__tests__/xlsx-parity.test.ts`

The only XLSX test checks config parity between server and web. Zero tests verify actual XLSX parsing (HTML-as-XLS, serial dates, multi-sheet, column matching, amount parsing). The entire XLSX pipeline is untested.

### F-TEST-02: No PDF parser tests
**Severity: High | Confidence: High | Agents: test-engineer, critic**
**File**: `packages/parser/__tests__/`

The PDF parser has a 3-tier approach (structured, fallback line scanning, LLM) — none tested. `table-parser.ts` column boundary detection, `extractor.ts` page extraction, and `llm-fallback.ts` JSON extraction are all untested.

### F-ARCH-01: Web-side CSV adapters still use exact indexOf() — weakest link
**Severity: High | Confidence: High | Agents: architect, code-reviewer, critic, tracer**
**File**: `apps/web/src/lib/parser/csv.ts` lines 318-321, 383-387, 449-453, etc.

All 10 web-side bank CSV adapters use `headers.indexOf('exact string')`. The server-side was fixed in cycle 1 with ColumnMatcher + adapter-factory, but the web-side was deferred. The user-facing web app has the weakest parsing while the CLI tool is the most robust.

**Cross-agent agreement**: 4 agents flagged this independently.

---

## MEDIUM SEVERITY FINDINGS

### F-TRC-01: ColumnMatcher adopted by only 1 of 5 header-detection parsers
**Severity: Medium | Confidence: High | Agents: tracer, architect**
**File**: `packages/parser/src/csv/column-matcher.ts`

Adoption matrix:
- Server CSV adapter-factory: YES
- Server CSV generic: NO (inline regex)
- Server XLSX: NO (inline regex)
- Web CSV adapters: NO (indexOf)
- Web XLSX: NO (inline regex)

### F-CR-02: Server-side adapter-factory header detection is weaker than generic parser
**Severity: Medium | Confidence: High | Agents: code-reviewer**
**File**: `packages/parser/src/csv/adapter-factory.ts` line 79

The adapter-factory only requires one keyword match for header detection. The generic parser requires keywords from 2+ categories. A summary row with one bank keyword would be misidentified.

### F-TRC-02: HEADER_KEYWORDS array duplicated 4 times
**Severity: Medium | Confidence: High | Agents: tracer, architect**
**Files**: `packages/parser/src/csv/generic.ts` lines 38-42, `packages/parser/src/xlsx/index.ts` lines 124-128, `apps/web/src/lib/parser/csv.ts` lines 149-153, `apps/web/src/lib/parser/xlsx.ts` lines 360-364

Four independent copies of the same Korean header keyword vocabulary. Adding a new keyword requires 4 edits.

### F-ARCH-02: XLSX bank column config exists in 3 places
**Severity: Medium | Confidence: High | Agents: architect**
**Files**: `packages/parser/src/xlsx/adapters/index.ts`, `apps/web/src/lib/parser/xlsx.ts`, `packages/parser/src/csv/adapter-factory.ts`

### F-ARCH-03: Web-side csv.ts is 1030 lines of mostly duplicated adapter code
**Severity: Medium | Confidence: High | Agents: architect, critic**

### F-DBG-02: Server-side XLSX parseDateToISO silently returns raw string for unparseable dates
**Severity: Medium | Confidence: High | Agents: debugger**
**File**: `packages/parser/src/xlsx/index.ts` lines 29-53

### F-TEST-03: No encoding detection tests (EUC-KR / CP949 / UTF-8)
**Severity: Medium | Confidence: High | Agents: test-engineer**

### F-TEST-04: No parseDateStringToISO edge case tests
**Severity: Medium | Confidence: High | Agents: test-engineer**

### F-TEST-05: CSV adapter tests don't test edge cases per bank
**Severity: Medium | Confidence: High | Agents: test-engineer**

### F-TEST-06: No test for server-side parseStatement entry point
**Severity: Medium | Confidence: High | Agents: test-engineer**

### F-DBG-04: Generic CSV merchant inference can pick wrong column
**Severity: Medium | Confidence: High | Agents: debugger**
**File**: `packages/parser/src/csv/generic.ts` lines 124-131

---

## LOW SEVERITY FINDINGS

### F-CR-03: Server-side XLSX returns first sheet, not best sheet
**Severity: Low | Confidence: High | Agents: code-reviewer**
**File**: `packages/parser/src/xlsx/index.ts` lines 106-116

### F-CR-04: Unused isValidCSVAmount export from shared.ts
**Severity: Low | Confidence: High | Agents: code-reviewer**

### F-CR-08: splitCSVLine only handles RFC 4180 for commas
**Severity: Low | Confidence: High | Agents: code-reviewer**

### F-PERF-01: Server-side detectFormat reads CSV files twice
**Severity: Low | Confidence: High | Agents: perf-reviewer**

### F-SEC-02: PDF text extraction has no size limit
**Severity: Low | Confidence: Medium | Agents: security-reviewer**

### F-DOC-01: Server-side BOM stripping uses literal BOM character
**Severity: Low | Confidence: High | Agents: document-specialist, verifier**

### F-DBG-06: PDF extractText error message doesn't distinguish encrypted PDFs
**Severity: Low | Confidence: Medium | Agents: debugger**

---

## AGENT FAILURES
None. All 10 reviewer agents completed successfully.

---

## CROSS-AGENT AGREEMENT HIGHLIGHTS
1. **4 agents** flagged web-side CSV adapters using exact indexOf() (F-ARCH-01)
2. **3 agents** flagged server-side XLSX missing category requirement (F-DBG-01)
3. **2 agents** flagged zero XLSX test coverage (F-TEST-01)
4. **2 agents** flagged zero PDF test coverage (F-TEST-02)
5. **2 agents** flagged ColumnMatcher adoption gap (F-TRC-01)

---

## TOTAL FINDINGS: 20 (4 High, 9 Medium, 7 Low)