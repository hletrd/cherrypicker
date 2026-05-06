# Aggregate Review — CherryPicker Cycle 38

**Date:** 2026-05-06
**Cycle:** 38 / 100

---

## Executive Summary

Cycle 38 is a **consistency-focused maintenance cycle**. Three prior findings from cycle 37 were verified fixed (BUG-37-01 JSON silent data loss, C37-V04 isOnline dead code, C37-V07 NaN propagation). One new medium-severity systemic inconsistency was identified: HTML/XLSX/CSV parsers silently skip non-positive amounts while JSON/OFX parsers report ParseErrors. Additionally, several carryover issues remain unaddressed.

| Severity | Verified Fixed | New (Cycle 38) | Carryover | Total Open |
|----------|---------------|----------------|-----------|------------|
| Critical | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 3 | 3 |
| Medium | 3 | 2 | 12 | 14 |
| Low | 0 | 2 | 18 | 20 |

---

## Verified Fixed in Cycle 38

| ID | Finding | File | Evidence |
|----|---------|------|----------|
| BUG-37-01 | JSON parser silently drops refunds/credits | `json/index.ts:138` | ParseError now emitted for amount <= 0 (commit 4672848) |
| C37-V04 | isOnline dead code | `reward.ts:47`, schema, YAML | `excludeOnline` removed from schema, YAML, tests (commit b5c393d) |
| C37-V07 | NaN propagation in previousMonthSpending | `analyzer.ts` | `Number.isFinite` validation added (commit 589af72) |

---

## New Findings (Cycle 38)

### Debugger / Correctness

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-38-01 | Medium | `packages/parser/src/html/index.ts:249`, `apps/web/src/lib/parser/html.ts:259` | HTML parser silently skips non-positive amounts without ParseError, unlike JSON/OFX |
| BUG-38-02 | Medium | `packages/parser/src/xlsx/index.ts:416` | XLSX parser silently skips non-positive amounts without ParseError |

### Code Review

| ID | Severity | File | Description |
|----|----------|------|-------------|
| CR-38-01 | Medium | `packages/parser/src/csv/shared.ts:122` | `isValidCSVAmount` silently returns false for amount <= 0 without error |
| CR-38-02 | Low | `apps/web/src/lib/parser/xlsx.ts` | Web-side XLSX parser likely also silently skips non-positive amounts |

### Architecture

| ID | Severity | File | Description |
|----|----------|------|-------------|
| ARCH-38-01 | Low | All parsers | Inconsistent error reporting for filtered transactions across parsers |

---

## Carryover Issues (Still Open)

### High Priority Carryover

| ID | Description | File |
|----|-------------|------|
| BUG-3 | NaN propagation in previousMonthSpending (partially fixed - web only, core calculator may still have issue) | `store.svelte.ts:567` |
| BUG-4 | EUC-KR HTML detection failure | `xlsx.ts:99` |
| BUG-7 | OFX credits silently skipped (partially fixed - ParseError added) | `ofx.ts:146` |

### Medium Priority Carryover (Selection)

| ID | Description | File |
|----|-------------|------|
| CR-01 | Silent JSON.parse error swallowing in detect.ts | `detect.ts:286` |
| CR-02 | Silent HTML parser error swallowing | `html/index.ts:48` |
| CR-09 | Windows path bug in CLI (appears FIXED in analyze.ts) | `tools/cli/` |
| CR-10 | Outdated hardcoded model name (appears FIXED - now env-driven) | `extractor.ts:34` |
| CR-15 | ReDoS risk in SUMMARY_ROW_PATTERN | `column-matcher.ts` |
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` |
| SEC-07 | Non-KRW transactions silently skipped | `reward.ts:220` |
| PERF-02 | Optimizer O(N*M*T) | `greedy.ts:39-66` |
| PERF-06 | cardPreviousSpending O(cards*tx) | `analyzer.ts:224` |
| C32-V03 | Web UTF-16 not supported | `parser/index.ts:26` |
| BUG-37-02 | OFX date timezone math is confusing/fragile | `ofx/index.ts:88-115` |
| BUG-37-03 | normalizeHTML could strip legitimate content | `html.ts:33-35` |

### Deferred (Exit Criteria Not Met)

| ID | Description | Reason | Exit Criterion |
|----|-------------|--------|----------------|
| SEC-08 | sessionStorage encryption | Requires UX key management | Dedicated security cycle |
| PERF-02 | Optimizer incremental update | Needs benchmarking | Performance optimization cycle |
| PERF-01 | keywords.ts bundle size | Requires measurement | Bundle analysis cycle |
| CR-07/CR-17 | Type unification + parser dedup | Large refactoring | Parser API refactor cycle |

---

## Cross-Agent Agreement

1. **Silent Data Loss Inconsistency** (BUG-38-01, BUG-38-02, CR-38-01): **AGREED** by debugger, code-reviewer, critic. JSON/OFX parsers now report ParseErrors for non-spending amounts, but HTML/XLSX/CSV paths still silently skip them.

---

## Recommendations

1. **FIX THIS CYCLE:**
   - BUG-38-01/02 (HTML/XLSX silent skip) — add ParseError for non-positive amounts
   - CR-38-01 (CSV isValidCSVAmount) — add ParseError for non-positive amounts

2. **FIX RECOMMENDED:**
   - Add parity tests verifying all parsers emit ParseErrors for non-positive amounts
   - Fix misleading parseOFXDate JSDoc (carryover from BUG-37-02)

3. **SCHEDULE FOR FUTURE:**
   - Parser unification (extract shared amount validation)
   - Core calculator NaN propagation audit
   - CSP nonce implementation

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | TBD |
| `npm run typecheck` | TBD |
| `bun run test` | TBD |
