# Cycle 5 Implementation Plan (2026-05-05)

**Date:** 2026-05-05
**Source reviews:** `.context/reviews/*.md` (Cycle 5)
**Status:** Draft

---

## Critical Priority — Must Fix This Cycle

### C1: Add explicit LLM fallback consent flow
- **Severity:** P0-CRITICAL
- **Agent:** security-reviewer (S-SEC-01)
- **Files:** `packages/parser/src/pdf/llm-fallback.ts`, `tools/cli/src/commands/`
- **Description:** LLM fallback sends up to 8000 characters of raw financial statement text to Anthropic without explicit per-use consent. Users may unknowingly transmit sensitive data.
- **Action:**
  1. In CLI: Add interactive prompt before LLM fallback: "This will send up to 8000 characters of your statement to Anthropic. Continue? (y/N)"
  2. Add `--allow-remote-llm` flag validation: if not passed, throw with instructions
  3. In web: Show a modal explaining data transmission before LLM fallback
  4. Document Anthropic data retention in README
- **Risk:** Medium — touches CLI UX and requires new error messages
- **Verification:** Test CLI with and without flag; verify prompt text appears

---

### C2: Harden HTML report `esc()` function
- **Severity:** P1-HIGH
- **Agent:** security-reviewer (S-SEC-02)
- **File:** `packages/viz/src/report/generator.ts:32-38`
- **Description:** `esc()` only escapes 4 entities (&, <, >, "). Missing single quote, backslash, forward slash, control characters.
- **Action:**
  1. Replace custom `esc()` with `html-escaper` package (already widely used, zero-deps)
  2. Or manually add escapes for `'`, `/`, `\`, and null bytes
  3. Add test for each escape case
- **Risk:** Low — behavior-preserving change
- **Verification:** Unit tests for each entity; run existing report tests

---

### C3: Validate Anthropic API key format
- **Severity:** P1-HIGH
- **Agent:** security-reviewer (S-SEC-03)
- **File:** `packages/parser/src/pdf/llm-fallback.ts:38-43`
- **Description:** No validation of key format. Malformed keys are sent to Anthropic, potentially logging partial keys in error responses.
- **Action:**
  1. Add validation: `if (!apiKey.startsWith('sk-ant-') || apiKey.length < 20)`
  2. Throw descriptive error with format hint
  3. Add test for valid key, invalid prefix, short key
- **Risk:** Low — additive validation
- **Verification:** New unit tests pass

---

### C4: Remove hardcoded CATEGORY_NAMES_KO from optimizer
- **Severity:** P1-HIGH
- **Agents:** critic (F-CRI-02), architect (A-ARCH-02)
- **File:** `packages/core/src/optimizer/greedy.ts:11-90`
- **Description:** 79 lines of hardcoded Korean labels duplicate `packages/rules/data/categories.yaml`. Drift risk if YAML is updated.
- **Action:**
  1. Change `optimize()` signature to accept `categoryLabels: Record<string, string>`
  2. Remove `CATEGORY_NAMES_KO` constant
  3. Update all call sites to pass labels loaded from YAML or `@cherrypicker/rules`
  4. Update tests to pass category labels
- **Risk:** Medium — signature change affects all callers
- **Verification:** Tests pass; grep shows no `CATEGORY_NAMES_KO` references

---

### C5: Import CardRuleSet from @cherrypicker/rules in web app
- **Severity:** P1-HIGH
- **Agents:** architect (A-ARCH-03), code-reviewer (C-CR-04)
- **File:** `apps/web/src/lib/cards.ts:14-52`
- **Description:** 38 lines of inline `CardRuleSet` type duplication. `@cherrypicker/rules` already exports this type.
- **Action:**
  1. Remove inline `CardRuleSet` definition
  2. Add `import type { CardRuleSet } from '@cherrypicker/rules'`
  3. Verify `package.json` dependency exists
  4. Run typecheck
- **Risk:** Low — one-line import change
- **Verification:** `npm run typecheck` passes; no TS errors in web app

---

## High Priority — Fix This Cycle

### H1: Add structured ParseError with file/format/line context
- **Severity:** P1-HIGH
- **Agent:** tracer (R-TRA-01)
- **Files:** All parsers in `packages/parser/src/`
- **Description:** Parser errors are plain strings with no structured context. Callers cannot show useful error messages.
- **Action:**
  1. Define `ParseError` class extending Error with `{ file, format, line, raw }`
  2. Wrap all `throw new Error(...)` in parsers with ParseError
  3. Update error handling in web app to use structured fields
- **Risk:** Low — additive, backward-compatible if Error is extended
- **Verification:** New parser tests verify error properties

---

### H2: Return LLM usage metadata from fallback
- **Severity:** P1-HIGH
- **Agent:** tracer (R-TRA-02)
- **File:** `packages/parser/src/pdf/llm-fallback.ts`
- **Description:** No model name, token count, truncation flag, or latency returned.
- **Action:**
  1. Change return type from `Promise<RawTransaction[]>` to `{ transactions: RawTransaction[]; meta: LLMMetadata }`
  2. Extract usage from Anthropic response (`message.usage`)
  3. Add `wasTruncated` boolean based on text length vs 8000 char limit
  4. Add `durationMs` timer
  5. Update all callers to handle new return shape
- **Risk:** Medium — return type change
- **Verification:** Tests verify metadata fields exist

---

### H3: Fix OFX date parser timezone stripping
- **Severity:** P1-HIGH
- **Agent:** debugger (D-DEB-03)
- **File:** `packages/parser/src/ofx/index.ts`
- **Description:** `replace(/[^0-9].*$/, '')` strips timezone offsets from OFX timestamps.
- **Action:**
  1. Parse full OFX datetime string including timezone
  2. Convert to UTC then to local Korean time
  3. Add test with timezone-aware OFX fixture
- **Risk:** Low — localized change
- **Verification:** New OFX test with `20240115120000[-5:EST]` fixture

---

### H4: Fix HTML forward-fill array mutation
- **Severity:** P1-HIGH
- **Agent:** debugger (D-DEB-05)
- **File:** `packages/parser/src/html/index.ts:137-215`
- **Description:** Forward-fill mutates rows in place during iteration, causing order-dependent behavior.
- **Action:**
  1. Use two-pass approach: first pass compute fill values, second pass apply
  2. Or clone rows before mutation
  3. Add test verifying forward-fill order independence
- **Risk:** Low — behavior-preserving fix
- **Verification:** HTML parser tests pass; new forward-fill test added

---

### H5: Add LRU cache to MerchantMatcher
- **Severity:** P1-HIGH
- **Agent:** perf-reviewer (P-PR-01)
- **File:** `packages/core/src/categorizer/matcher.ts:58-81`
- **Description:** Every transaction scans all ~10,000 keywords. For 1,000 transactions: 10M+ string operations.
- **Action:**
  1. Add simple `Map`-based LRU cache keyed by merchant name
  2. Cache size: 500 entries (covers typical statement duplicates)
  3. Return cached category if hit
- **Risk:** Low — additive caching, easy to disable
- **Verification:** Benchmark before/after; correctness tests pass

---

### H6: Add path validation to CLI file arguments
- **Severity:** P1-HIGH
- **Agent:** security-reviewer (S-SEC-04)
- **Files:** `tools/cli/src/commands/analyze.ts`, `optimize.ts`, `report.ts`
- **Description:** File paths from `process.argv` passed directly to `parseStatement()` with no validation.
- **Action:**
  1. Resolve paths to absolute
  2. Reject paths containing `..` segments
  3. Verify file exists before parsing
- **Risk:** Low — defensive validation
- **Verification:** Test with relative path, absolute path, path with `..`

---

## Medium Priority — Fix If Time Permits

### M1: Add CSP meta tag to generated HTML reports
- **Severity:** P2-MEDIUM
- **Agent:** security-reviewer (S-SEC-06)
- **File:** `packages/viz/src/report/templates/report.html`
- **Action:** Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none';">`

---

### M2: Cap header string length before regex matching
- **Severity:** P2-MEDIUM
- **Agent:** security-reviewer (S-SEC-05)
- **File:** `packages/parser/src/csv/column-matcher.ts`
- **Action:** If header length > 200 chars, skip regex matching and fall back to generic matching

---

### M3: Add optimizer assignment trace
- **Severity:** P2-MEDIUM
- **Agent:** tracer (R-TRA-03)
- **File:** `packages/core/src/optimizer/greedy.ts`
- **Action:** Add optional `trace?: AssignmentTrace[]` to `OptimizationResult`

---

## Deferred to Future Cycles

| Finding | Severity | Reason for deferral | Exit criterion |
|---------|----------|---------------------|----------------|
| Server/web parser structural unification | P0-CRITICAL | Requires dedicated refactor sprint with design doc | Create `packages/parser/src/shared/`; migrate one parser at a time |
| Greedy optimizer marginal reward caching | P1-HIGH | Algorithmic refactor; needs benchmark baseline first | Add `greedy.bench.ts` first, then refactor |
| PDF text extraction streaming | P2-MEDIUM | Requires pdfjs-dist streaming API investigation | Profile memory usage with 100+ page PDFs |
| No web component tests | P1-HIGH | Requires `@testing-library/svelte` setup | Add Vitest Svelte component testing config |
| No parser parity tests | P1-HIGH | Requires shared fixtures and dual runner | Create `packages/parser/__tests__/parity/` with fixtures |
| No CLI integration tests | P2-MEDIUM | Requires temp file fixtures and stdout capture | Add `tools/cli/__tests__/integration.test.ts` |
| No optimizer benchmarks | P2-MEDIUM | Requires Vitest bench or custom timer | Add `packages/core/benchmark/greedy.bench.ts` |
| LLM fallback untestable | P2-MEDIUM | Requires dependency injection refactor | Extract Anthropic client to constructor param |
| No architecture documentation | P2-MEDIUM | Writing task; not blocking | Create `ARCHITECTURE.md` and `RULES_SCHEMA.md` |
| No brute-force benchmark | P2-MEDIUM | Research task | Add brute-force verifier for N<=10 cards |
| Results display lacks transaction detail | P2-MEDIUM | UI redesign | Add expandable transaction list in results view |

---

## Implementation Order

1. C5 — CardRuleSet import (one-liner, lowest risk)
2. C3 — API key validation (additive, isolated)
3. C2 — HTML esc() hardening (behavior-preserving)
4. H3 — OFX timezone fix (localized parser change)
5. H4 — HTML forward-fill idempotency (localized parser change)
6. C1 — LLM consent flow (CLI UX change)
7. H1 — ParseError structured errors (multi-file but additive)
8. H2 — LLM usage metadata (return type change)
9. C4 — CATEGORY_NAMES_KO parameterization (signature change)
10. H5 — MerchantMatcher LRU cache (performance, localized)
11. H6 — CLI path validation (defensive)
12. M1 — CSP meta tag (one-line)
13. M2 — Header length cap (defensive)
14. Run gates (lint, typecheck, test)
15. Commit each fix separately with semantic messages
