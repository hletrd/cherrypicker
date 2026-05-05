# Cycle 6 Aggregate Review

**Date:** 2026-05-06
**Scope:** Full repository — cherrypicker Korean credit card optimizer

---

## Summary

Cycle 6 delivered 5 significant commits addressing Cycle 5 findings: ParseError class with context, LLM consent flow, path validation, LRU cache for MerchantMatcher, and removal of hardcoded CATEGORY_NAMES_KO. All gates pass (0 lint errors, 0 type errors, 161 tests passing). However, one new HIGH-severity data integrity bug was introduced in the JSON parser, and web-side parser parity remains incomplete.

**Cycle 6 stats:** 4 agents reviewed. 9 new findings: 0 critical, 3 high, 5 medium. 2 Cycle 5 criticals verified fixed, 4 remain open.

---

## Critical Findings (4 remaining from Cycle 5)

| ID | Agent | Description | File | Status |
|----|-------|-------------|------|--------|
| C-CR-01 | code-reviewer | Non-KRW transactions silently dropped | `packages/core/src/calculator/reward.ts:219` | **OPEN** |
| F-CRI-01 | critic | Server/web parser duplication — no structural fix after 5 cycles | `packages/parser/` vs `apps/web/src/lib/parser/` | **OPEN** |
| A-ARCH-01 | architect | Server/web parser duplication — partial parity only | `packages/parser/` vs `apps/web/src/lib/parser/` | **OPEN** |
| S-SEC-02 | security-reviewer | HTML report `esc()` only handles 7 entities — XSS risk | `packages/viz/src/report/generator.ts:31-40` | **OPEN** |

---

## New High Findings (Cycle 6)

### C6-01: JSON parser silently converts refunds to purchases via `Math.abs`

**Agent:** code-reviewer | **File:** `packages/parser/src/json/index.ts:116` | **Confidence:** High

`Math.abs(amount)` on negative values converts refunds to purchases. The comment incorrectly claims this "accepts negative amounts." The optimizer's positive-only filter (`greedy.ts:204`) already skips non-positive amounts, so preserving negatives is safe and transparent.

**Fix:** Remove `Math.abs()`. Set `tx.amount = amount` directly.

### C6-02: Web-side ParseError remains plain interface

**Agent:** code-reviewer | **Files:** `apps/web/src/lib/parser/types.ts:30-34` vs `packages/parser/src/types.ts:30-47` | **Confidence:** High

Web-side `ParseError` is an interface; server-side is a class extending Error. Breaks `instanceof` checks, enrichment, and error context parity. `enrichErrors()` in `parseStatement()` will not backfill web-side errors.

**Fix:** Align web-side `types.ts` with server-side class definition.

### A6-01: categoryLabels Map construction duplicated across 5+ call sites

**Agent:** architect | **Files:** Multiple CLI commands + viz + web | **Confidence:** High

Same 8-line block repeated in analyze.ts, optimize.ts, report.ts, terminal/summary.ts, and web analyzer.ts. Recreates the hardcoding anti-pattern that CATEGORY_NAMES_KO suffered from.

**Fix:** Extract shared `buildCategoryLabelMap()` utility in `packages/rules/`.

---

## New Medium Findings (Cycle 6)

| ID | Agent | Description | File |
|----|-------|-------------|------|
| C6-03 | code-reviewer | Outdated Anthropic model name `claude-sonnet-4-6` | `packages/parser/src/pdf/llm-fallback.ts:50` |
| C6-04 | code-reviewer | Consent prompt hardcoded in English | `tools/cli/src/consent.ts:23` |
| S6-01 | security-reviewer | Path validation gaps: null bytes, symlinks | `tools/cli/src/validation.ts:7-29` |
| S6-02 | security-reviewer | LLM consent prompt has no timeout | `tools/cli/src/consent.ts:16-28` |
| T6-01 | test-engineer | ParseError test is vacuous | `packages/parser/__tests__/parse-error.test.ts:34-43` |
| T6-02 | test-engineer | No parity tests between server/web parsers | `packages/parser/` vs `apps/web/src/lib/parser/` |
| T6-03 | test-engineer | No tests for JSON negative amount handling | `packages/parser/src/json/index.ts:116` |

---

## Verified Fixes (Cycle 6)

| Issue | File | Commit | Evidence |
|-------|------|--------|----------|
| CATEGORY_NAMES_KO hardcoded | `packages/core/src/optimizer/greedy.ts` | e8351ee | Removed 80-line inline constant; `categoryLabels` required parameter |
| LLM fallback without consent | `tools/cli/src/consent.ts` | 41fb34c | `--allow-remote-llm` enforced; interactive prompt added |
| Path traversal in CLI | `tools/cli/src/validation.ts` | ce91407 | `..` segments rejected; existence verified |
| MerchantMatcher O(n*m) scan | `packages/core/src/categorizer/matcher.ts` | f7adfe8 | LRU cache with 500-entry cap added |
| Parser errors lack context | `packages/parser/src/types.ts` | 87aa83a | `ParseError` class with `file/format/line/raw` |

---

## Still Open from Previous Cycles

| Finding | First Cycle | Status |
|---------|-------------|--------|
| Server/web parser duplication | 2 | **OPEN** |
| Card rules type duplicated in web app | 4 | **OPEN** |
| No brute-force benchmark | 4 | **OPEN** |
| Deferred-fix tracking fragmented | 4 | **OPEN** |
| PDF three code paths | 4 | **OPEN** |
| HTML esc() incomplete | 4 | **OPEN** |
| Regex DoS in column patterns | 4 | **OPEN** |
| Missing CSP in HTML reports | 5 | **OPEN** |

---

## Cross-Cutting Themes

1. **Parser Parity:** Server and web parsers diverge in type systems (ParseError class vs interface) while converging in behavior (forward-fill, new formats). The structural fix (shared core) is still needed.
2. **Duplication Debt:** categoryLabels building is the new CATEGORY_NAMES_KO — same anti-pattern, different variable. Shared utilities prevent this class of bug.
3. **Data Integrity:** JSON parser's `Math.abs(amount)` silently corrupts refund data. This is the most impactful new finding.
4. **Security Surface Reduced:** LLM consent and path validation are solid additions, but edge cases (symlinks, timeouts) remain.

---

## Verdict

**FIX NOW:** C6-01 (JSON Math.abs), C6-02 (web ParseError parity), A6-01 (categoryLabels duplication).
**MONITOR:** Parser parity drift, LLM consent edge cases in CI.
**REDESIGN REQUIRED:** Server/web parser structural unification remains the highest-value architectural investment.
