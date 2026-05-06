# Aggregate Review — CherryPicker Cycle 37

**Date:** 2026-05-06
**Reviews performed by:** code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, critic, verifier, designer, document-specialist
**Cycle:** 37 / 100

---

## Executive Summary

Cycle 37 is a **maintenance cycle** with no structural changes. Three prior findings were verified fixed (including the critical BUG-1 per-transaction cap undercalculation). Four new medium/low issues were identified in the recently added HTML/OFX/JSON parsers. The dominant pattern is **silent data loss** — all parsers filter out certain transaction types without user-visible feedback.

All fundamental architectural debts (parser duplication, type leakage, optimizer complexity) remain untouched. The deferral culture for structural issues shows no signs of abating after 35+ cycles.

| Severity | Verified Fixed | New (Cycle 37) | Carryover | Total Open |
|----------|---------------|----------------|-----------|------------|
| Critical | 1 | 0 | 0 | 0 |
| High | 2 | 0 | 4 | 4 |
| Medium | 0 | 5 | 18 | 23 |
| Low | 0 | 7 | 22 | 29 |

---

## Verified Fixed in Cycle 37

| ID | Finding | File | Evidence |
|----|---------|------|----------|
| **BUG-1** | Per-transaction cap on amount (20x undercalc) | `reward.ts:271-277` | `perTxCap` now applied to reward, not amount |
| C32-V09 | JSON non-deterministic field matching | `json/index.ts:75-79` | Alias priority order scan, not Object.keys order |
| C32-V01 | XLSX blank-row forward-fill leak | `xlsx/index.ts:307-316` | Blank rows now reset all last* values |

---

## New Findings (Cycle 37) — Priority Ordered

### Security

| ID | Severity | File | Description |
|----|----------|------|-------------|
| SEC-37-01 | Low | `json/index.ts:212-216` | JSON wrapper key case-insensitive match lacks Object.hasOwn |

### Performance

| ID | Severity | File | Description |
|----|----------|------|-------------|
| PERF-37-01 | Low | `json/index.ts:200-220` | Wrapper key scanning is O(keys x wrappers) instead of O(keys) |

### Test Engineering

| ID | Severity | File | Description |
|----|----------|------|-------------|
| TE-37-01 | Medium | `ofx/index.ts:29-31` | No tests for OFX CCSTMTRS (credit card) parsing |
| TE-37-02 | Medium | `html/index.ts:139-237` | No tests for HTML forward-fill logic |
| TE-37-03 | Medium | `json/index.ts:138` | No tests for JSON negative amount handling |
| TE-37-04 | Medium | `packages/parser/` vs `apps/web/` | No parity tests for HTML/OFX/JSON |
| TE-37-05 | Low | `ofx/index.ts:88-115` | No tests for OFX timezone conversion |

### Architecture

| ID | Severity | File | Description |
|----|----------|------|-------------|
| ARCH-37-01 | Low | `packages/parser/` vs `apps/web/` | New parsers add ~1235 lines of duplication |

### Debugger / Correctness

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-37-01 | Medium | `json/index.ts:138` | JSON parser silently drops refunds/credits |
| BUG-37-02 | Medium | `ofx/index.ts:88-115` | OFX date timezone math is confusing/fragile |
| BUG-37-03 | Low | `html.ts:33-35` | `normalizeHTML` could strip legitimate content |
| BUG-37-04 | Low | `ofx/index.ts:67-78` | OFX extractTag double-regex is inefficient |

### Code Review

| ID | Severity | File | Description |
|----|----------|------|-------------|
| CR-37-01 | Medium | `json/index.ts:138` | JSON drops negative amounts without error |
| CR-37-02 | Low | `html/index.ts:47` | HTML parser assumes UTF-8 input |
| CR-37-03 | Low | `ofx/index.ts:67-78` | extractTag regex missing length validation |
| CR-37-04 | Low | `html.ts:33-35` | normalizeHTML while-loop regex risk |

### Critic / Design

| ID | Severity | File | Description |
|----|----------|------|-------------|
| C37-CRIT01 | Critical | All parsers | "Parity" comments are false substitute for shared code |
| C37-CRIT02 | High | All parsers | Silent data loss is a systemic pattern |
| C37-CRIT03 | High | Pervasive | Cycle reference convention has become technical debt |
| C37-CRIT04 | Medium | New parsers | New formats add complexity without clear value proposition |
| C37-CRIT05 | Medium | `html.ts:29-54` | normalizeHTML mixes security + parsing concerns |

### Verifier

| ID | Status | File | Description |
|----|--------|------|-------------|
| C37-V04 | STILL BROKEN | `reward.ts:47` | `isOnline` never populated |
| C37-V05 | STILL BROKEN | `matcher.ts:128` | FIFO cache eviction (not LRU) |
| C37-V06 | STILL BROKEN | `parser/index.ts:26` | Web UTF-16 not supported |
| C37-V07 | STILL BROKEN | `store.svelte.ts:567` | NaN propagation in previousMonthSpending |

### Designer / UX

| ID | Severity | File | Description |
|----|----------|------|-------------|
| U-DES-37-01 | Medium | All parsers → UI | No feedback when transactions are filtered out |
| U-DES-37-02 | Low | `store.svelte.ts` | Parse errors not differentiated by file/format |

### Documentation

| ID | Severity | File | Description |
|----|----------|------|-------------|
| DOC-37-01 | Medium | `ofx/index.ts:85` | Misleading JSDoc on parseOFXDate timezone math |
| DOC-37-02 | Low | New parsers | Missing `@throws` / error behavior docs on entry functions |

---

## Cross-Agent Agreement

1. **Silent Data Loss** (BUG-37-01, C37-CRIT02, U-DES-37-01): **AGREED** by debugger, critic, designer, code-reviewer. All parsers silently drop transactions; no user feedback.
2. **Parser Duplication** (ARCH-37-01, C37-CRIT01): **AGREED** by architect, critic, code-reviewer. New parsers add ~1235 lines of duplication with no automated parity.
3. **normalizeHTML Concerns** (CR-37-04, C37-CRIT05, C32-V13): **AGREED** by security-reviewer, code-reviewer, critic. Regex-based stripping has ReDoS risk and mixes security/parsing concerns.

---

## Carryover Issues (Still Open from Cycles 32-36)

### High Priority Carryover

| ID | Description | File |
|----|-------------|------|
| C32-V02 | `isOnline` dead code — excludeOnline rules unreachable | `reward.ts:47` |
| BUG-3 | NaN propagation in previousMonthSpending | `store.svelte.ts:567` |
| BUG-4 | EUC-KR HTML detection failure | `xlsx.ts:99` |
| BUG-7 | OFX credits silently skipped | `ofx.ts:146` |

### Medium Priority Carryover (Selection)

| ID | Description | File |
|----|-------------|------|
| CR-01 | Silent JSON.parse error swallowing | `detect.ts:286` |
| CR-02 | Silent HTML parser error swallowing | `html/index.ts:48` |
| CR-09 | Windows path bug in CLI | `tools/cli/` |
| CR-10 | Outdated hardcoded model name | `extractor.ts:34` |
| CR-15 | ReDoS risk in SUMMARY_ROW_PATTERN | `column-matcher.ts` |
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` |
| SEC-07 | Non-KRW transactions silently skipped | `reward.ts:220` |
| PERF-02 | Optimizer O(N*M*T) | `greedy.ts:39-66` |
| PERF-06 | cardPreviousSpending O(cards*tx) | `analyzer.ts:224` |
| C32-V03 | Web UTF-16 not supported | `parser/index.ts:26` |
| C32-V07 | FIFO cache eviction | `matcher.ts:128` |
| C32-V08 | AbortController reuse in scraper | `fetcher.ts:38` |

### Deferred (Exit Criteria Not Met)

| ID | Description | Reason |
|----|-------------|--------|
| SEC-08 | sessionStorage encryption | Requires UX key management |
| PERF-02 | Optimizer incremental update | Needs benchmarking |
| PERF-01 | keywords.ts bundle size | Requires measurement |
| CR-07/CR-17 | Type unification + parser dedup | Large refactoring |

---

## Recommendations

1. **FIX BEFORE SHIP:**
   - C37-V04 (`isOnline` dead code) — silent incorrect reward calculation
   - C37-V07 (NaN propagation) — complete analysis corruption
   - BUG-37-01 (JSON silent data loss) — refunds dropped without error

2. **FIX RECOMMENDED (This Cycle):**
   - Add parse error for negative amounts in all parsers (address systemic silent data loss)
   - Add parity tests for HTML/OFX/JSON
   - Fix misleading `parseOFXDate` JSDoc

3. **SCHEDULE FOR NEXT MAJOR CYCLE:**
   - Parser unification (HTML/JSON/OFX are pure string processing)
   - Cycle-reference convention cleanup
   - README accuracy fixes

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS |

---

## Agent Notes

- All reviews performed manually due to unavailability of Agent spawning tool.
- Reviews verified against current HEAD (commits through 8fb7603).
- New parser code (HTML, OFX, JSON) reviewed against both server and web implementations.
- Cross-agent agreement identified three clusters: silent data loss, parser duplication, normalizeHTML concerns.
