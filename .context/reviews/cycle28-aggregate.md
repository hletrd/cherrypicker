# Aggregate Review — Cycle 28

## Summary
Focused review of parser package architecture, amount parsing parity between server and web, and security hardening opportunities in HTML normalization. 3 reviewer perspectives applied. The codebase is in good shape after 27 cycles of refinement. Most findings are code-quality and architectural improvements rather than functional bugs.

---

## MEDIUM SEVERITY FINDINGS

### C28-CR01: Server-side XLSX parser retains local `parseAmount` wrapper after C27 extraction
**Severity: Medium | Confidence: High | Agents: code-reviewer, architect**
**File**: `packages/parser/src/xlsx/index.ts:151-164`

C27-COR03 extracted a shared `parseAmount` to `apps/web/src/lib/parser/amount.ts`. The server-side XLSX parser still defines its own local wrapper. Cross-agent agreement: 2 agents flagged this.

### C28-ARCH01: Server-side amount parsing lacks a dedicated module
**Severity: Medium | Confidence: High | Agents: architect, code-reviewer**
**File**: `packages/parser/src/` (missing `amount.ts`)

`parseAmountString` is buried in `csv/shared.ts` and the `parseAmount` wrapper is duplicated in `xlsx/index.ts`. The web side has a clean `amount.ts` module. Cross-agent agreement: 2 agents.

### C28-TEST01: No dedicated tests for web-side `parseAmount` in `amount.ts`
**Severity: Medium | Confidence: High | Agents: test-engineer**
**File**: `apps/web/src/lib/parser/amount.ts` (no test file)

The extracted `parseAmount` function has no direct test coverage. Edge cases (full-width digits, parenthesized negatives, trailing minus, etc.) are only tested indirectly.

---

## LOW SEVERITY FINDINGS

### C28-CR02: Missing dedicated server-side `amount.ts` module
**Severity: Low | Confidence: High | Agents: code-reviewer, architect**

Related to C28-ARCH01. The server side should mirror the web side's module structure.

### C28-CR03: `normalizeHTML` strips event handlers but not `javascript:` URLs
**Severity: Low | Confidence: Medium | Agents: security-reviewer, code-reviewer**
**File**: `apps/web/src/lib/parser/html.ts:29-46`

Defense-in-depth: add `javascript:` URL stripping even though HTML is currently only passed to SheetJS.

### C28-CR04: Web-side PDF fallback scanner uses `dateMatch[0]` while server-side uses `dateMatch[1]`
**Severity: Low | Confidence: High | Agents: code-reviewer**
**Files**: `apps/web/src/lib/parser/pdf.ts:594`, `packages/parser/src/pdf/index.ts:376`

Inconsistent access pattern for regex match results. Both work for current regex but one will break if capture groups change.

### C28-TEST02: Server-side XLSX `parseAmount` wrapper has no direct test coverage
**Severity: Low | Confidence: High | Agents: test-engineer**
**File**: `packages/parser/src/xlsx/index.ts:151-164`

No tests verify number-input rounding, non-finite handling, or non-string/non-number inputs.

### C28-ARCH02: Parser package index.ts does not export parseAmount
**Severity: Low | Confidence: High | Agents: architect**
**File**: `packages/parser/src/index.ts`

The public API lacks the `parseAmount` wrapper, forcing consumers to import from internal modules.

### C28-SEC02: PDF text extraction has no configurable size limit
**Severity: Low | Confidence: Medium | Agents: security-reviewer**

Carry-over from earlier reviews. Maliciously large PDFs could cause OOM.

---

## CROSS-AGENT AGREEMENT HIGHLIGHTS
1. **2 agents** flagged server-side amount parsing lacking a dedicated module (C28-CR01 / C28-ARCH01)
2. **2 agents** flagged `javascript:` URL sanitization gap (C28-SEC01 / C28-CR03)

---

## TOTAL FINDINGS: 8 (3 Medium, 5 Low)
## AGENT FAILURES: None. All reviewer agents completed successfully.
