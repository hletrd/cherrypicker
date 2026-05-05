# Cycle 6 Implementation Plan

**Date:** 2026-05-06
**Source:** Cycle 6 aggregate review (_aggregate.md)
**Priority:** Security and correctness first, then maintainability

---

## Plan 01: Fix JSON parser silently converting refunds to purchases [C6-01] — HIGH ✅ COMPLETED

**Commit:** `fix(parser): 🐛 preserve negative amounts in JSON parser instead of taking absolute value`

**Finding:** `packages/parser/src/json/index.ts:116` uses `Math.abs(amount)`, converting negative refund amounts to positive purchases.

**Impact:** Data integrity. Refunds are silently treated as spending, inflating totals and potentially pushing users into higher performance tiers.

**Implementation:**
1. Remove `Math.abs(amount)` in `parseTransactionObject`
2. Set `tx.amount = amount` directly (preserving negative for refunds)
3. Update the misleading comment (currently says "accepts negative amounts by taking absolute value")
4. Verify: the optimizer already filters `amount <= 0` at `greedy.ts:204`, so negative amounts are safely skipped in optimization

**Files:**
- `packages/parser/src/json/index.ts`

**Commit:** `fix(parser): 🐛 preserve negative amounts in JSON parser instead of taking absolute value`

---

## Plan 02: Align web-side ParseError with server-side class [C6-02] — HIGH ✅ COMPLETED

**Commit:** `fix(web/parser): align web-side ParseError with server-side class`

**Finding:** Web-side `ParseError` is an interface; server-side is a class. Breaks `instanceof`, enrichment, and error context parity.

**Impact:** Web app error reporting lacks file/format context. `enrichErrors()` in `parseStatement()` cannot backfill web-side errors.

**Implementation:**
1. Update `apps/web/src/lib/parser/types.ts` — change `ParseError` from `interface` to `class extends Error`
2. Add optional `file` and `format` fields to match server-side
3. Update all web parsers (html.ts, csv.ts, xlsx.ts, pdf.ts, json.ts, ofx.ts) to construct `new ParseError(...)` instead of plain objects
4. Update `analyzer.ts` parseErrors handling if needed

**Files:**
- `apps/web/src/lib/parser/types.ts`
- `apps/web/src/lib/parser/html.ts`
- `apps/web/src/lib/parser/csv.ts`
- `apps/web/src/lib/parser/xlsx.ts`
- `apps/web/src/lib/parser/pdf.ts`
- `apps/web/src/lib/parser/json.ts`
- `apps/web/src/lib/parser/ofx.ts`
- `apps/web/src/lib/analyzer.ts` (parseErrors type usage)

**Commit:** `fix(web): 🐛 align web-side ParseError with server-side class for parity`

---

## Plan 03: Extract shared categoryLabels builder utility [A6-01] — HIGH ✅ COMPLETED

**Commit:** `refactor(rules): ♻️ extract shared buildCategoryLabelMap utility`

**Finding:** `categoryLabels` Map construction is copy-pasted in 5+ locations.

**Impact:** Maintenance burden. When taxonomy structure changes, every call site must be updated independently.

**Implementation:**
1. Add `buildCategoryLabelMap(nodes: CategoryNode[]): Map<string, string>` to `packages/rules/src/category-names.ts`
2. Update `analyze.ts`, `optimize.ts`, `report.ts` in `tools/cli/src/commands/` to import and use it
3. Update `packages/viz/src/terminal/summary.ts` to use it
4. Verify `apps/web/src/lib/category-labels.ts` aligns with the new shared version
5. Export from `packages/rules/src/index.ts`

**Files:**
- `packages/rules/src/category-names.ts`
- `packages/rules/src/index.ts`
- `tools/cli/src/commands/analyze.ts`
- `tools/cli/src/commands/optimize.ts`
- `tools/cli/src/commands/report.ts`
- `packages/viz/src/terminal/summary.ts`

**Commit:** `refactor(rules): ♻️ extract shared buildCategoryLabelMap utility`

---

## Plan 04: Harden path validation against null bytes and symlinks [S6-01] — MEDIUM ✅ COMPLETED

**Commit:** `fix(cli): 🐛 harden path validation against null bytes and symlinks`

**Finding:** `validateFilePath()` doesn't strip null bytes or check for symlinks.

**Impact:** Potential path traversal via null-byte injection or symlink indirection.

**Implementation:**
1. Strip null bytes (`\x00`) from path before validation
2. Consider adding `lstat().isSymbolicLink()` check with clear error
3. Add tests for null-byte paths and symlink paths

**Files:**
- `tools/cli/src/validation.ts`
- `tools/cli/__tests__/commands.test.ts`

**Commit:** `fix(cli): 🐛 harden path validation against null bytes and symlinks`

---

## Plan 05: Add timeout to LLM consent interactive prompt [S6-02] — MEDIUM ✅ COMPLETED

**Commit:** `fix(cli): 🐛 localize LLM consent prompt and add 30-second timeout`

**Finding:** `promptConsent()` hangs indefinitely if stdin is empty or piped.

**Impact:** CI/job timeouts instead of clean errors.

**Implementation:**
1. Add 30-second timeout to `promptConsent()` Promise
2. Reject with clear Korean error message on timeout
3. Add test for timeout behavior

**Files:**
- `tools/cli/src/consent.ts`
- `tools/cli/__tests__/commands.test.ts`

**Commit:** `fix(cli): 🐛 add timeout to LLM consent prompt`

---

## Plan 06: Update default Anthropic model name [C6-03] — MEDIUM ✅ COMPLETED

**Commit:** `fix(parser): 🐛 update default Anthropic model name to claude-3-7-sonnet-latest`

**Finding:** Default model `claude-sonnet-4-6` is outdated.

**Impact:** Users without `ANTHROPIC_MODEL` env var call a non-existent model.

**Implementation:**
1. Update default in `llm-fallback.ts` to current stable model
2. Verify the model name is valid against Anthropic documentation

**Files:**
- `packages/parser/src/pdf/llm-fallback.ts`

**Commit:** `fix(parser): 🐛 update default Anthropic model name`

---

## Plan 07: Localize LLM consent prompt to Korean [C6-04] — MEDIUM ✅ COMPLETED

**Commit:** `fix(cli): 🐛 localize LLM consent prompt and add 30-second timeout`

**Finding:** Consent prompt is in English while all other CLI messages are Korean.

**Impact:** Inconsistent UX for Korean users.

**Implementation:**
1. Replace English prompt text with Korean equivalent

**Files:**
- `tools/cli/src/consent.ts`

**Commit:** `fix(cli): 🐛 localize LLM consent prompt to Korean`

---

## Deferred Items

### T6-01: ParseError structural test is vacuous — MEDIUM
**Reason:** Test-only finding, not blocking correctness. Can be addressed alongside other test improvements.
**Exit criterion:** When next parser test refactor occurs.

### T6-02: No parity tests between server/web parsers — HIGH
**Reason:** Requires significant test infrastructure (shared fixtures, cross-package imports). Out of scope for single-cycle fix.
**Exit criterion:** Dedicated parity test sprint.

### T6-03: No tests for JSON negative amount handling — MEDIUM
**Reason:** Will be addressed by Plan 01 implementation (the fix itself requires tests).
**Exit criterion:** Plan 01 complete.

### Cycle 5 criticals still open:
- C-CR-01: Non-KRW transactions silently dropped — requires reward calculator redesign
- F-CRI-01/A-ARCH-01: Parser duplication — requires dedicated architectural sprint
- S-SEC-02: HTML esc() incomplete — requires comprehensive encoding review
