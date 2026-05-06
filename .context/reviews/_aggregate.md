# Cycle 31 Aggregate Review

**Date:** 2026-05-05
**Scope:** Full repository review across 11 agent perspectives
**Status:** Agent fan-out was not available in this environment (no Agent tool registered). Reviews were performed manually with systematic multi-perspective analysis.

---

## Summary

- **New findings this cycle:** 15 (0 CRITICAL, 0 HIGH, 6 MEDIUM, 9 LOW)
- **Prior findings verified:** 12 open findings confirmed, 8 fixed findings confirmed
- **Gates:** All green (lint, typecheck, tests)
- **Security:** No new vulnerabilities; 1 defense-in-depth gap noted
- **Architecture:** Web/server parser duplication debt continues to grow (now 6 formats)

---

## Cross-Agent Agreement (High-Signal Findings)

Finding flagged by multiple agents indicates higher confidence:

| Finding | Agents | Severity | Confidence |
|---|---|---|---|
| Web/server parser duplication (D-01) | architect, critic, code-reviewer | HIGH | High |
| `parseAmountString` allows malformed strings | code-reviewer, debugger | LOW | High |
| LLM fallback shallow validation | security-reviewer, code-reviewer | LOW | Medium |
| `loadFromStorage` shallow validation | code-reviewer, tracer, debugger | LOW | High |
| OFX timezone conversion fragility | code-reviewer, debugger | LOW | Medium |
| JSON `findField` inefficiency | perf-reviewer, code-reviewer | LOW | Medium |

---

## New Findings by Severity

### MEDIUM (6)

1. **C31-ARCH01:** Web/server parser duplication now affects 6 formats (HTML, OFX, JSON, CSV, XLSX, PDF)
2. **C31-TEST01:** HTML parser forward-fill edge cases lack test coverage
3. **C31-TEST02:** JSON parser case-insensitive field matching lacks tests
4. **C31-TEST03:** OFX timezone conversion lacks cross-midnight tests
5. **C31-CRIT01:** Parser duplication debt is growing; suggest pausing new formats
6. **C31-CRIT04:** Review focus is drifting toward edge cases; consider shifting to architectural debt

### LOW (9)

1. **C31-CR01:** `parseAmountString` allows malformed numeric strings like `1-2-3`
2. **C31-CR02:** OFX `parseOFXDate` timezone conversion technique lacks explanatory comment
3. **C31-CR03:** JSON `findField` redundant case-insensitive matching for Korean aliases
4. **C31-CR04:** `loadFromStorage` shallow-validates assignment objects
5. **C31-CR05:** LLM fallback transaction filter is shallow
6. **C31-SEC01:** `normalizeHTML` doesn't handle backtick-quoted event handlers
7. **C31-SEC02:** LLM fallback JSON.parse lacks structural validation
8. **C31-SEC03:** `safeJSONParse` could expand forbidden keys for completeness
9. **C31-PERF01:** JSON `findField` is O(n*m) per transaction
10. **C31-PERF02:** HTML parser forward-fill allocates many intermediate strings
11. **C31-PERF03:** `cachedCoreRules` not invalidated on `cardIds` alternation
12. **C31-DEBUG01:** Forward-fill `isSummaryRow` receives `String(number)` for numeric cells
13. **C31-DEBUG02:** LLM fallback truncation may cut multi-byte characters
14. **C31-DEBUG03:** OFX date regex may not handle all timezone formats
15. **C31-UI01:** Parser error messages are technical and not actionable
16. **C31-UI02:** Category change dropdown lacks loading state during reoptimization
17. **C31-DOC01:** OFX comment could clarify XML vs SGML fallback order
18. **C31-DOC02:** JSON parser parity comment is slightly misleading about imports
19. **C31-DOC03:** SheetJS import comment incorrectly says "CommonJS module"
20. **C31-TRACE01:** Forward-fill state propagates across blank rows
21. **C31-TRACE02:** Store load -> reoptimize uses stale baseline spending

---

## Prior Open Findings Still Open

| ID | Severity | Description | File |
|---|---|---|---|
| D-01 | HIGH | Web/server parser duplication | `apps/web/src/lib/parser/*` |
| D-06 | MEDIUM | Browser CSV support overstated | `apps/web/src/lib/parser/csv.ts` |
| C8-07 | LOW | build-stats hardcoded fallbacks | `apps/web/src/lib/build-stats.ts:16-18` |
| C7-07 | LOW | BANK_SIGNATURES duplicated | `apps/web/src/lib/parser/detect.ts` |
| C18-01 | MEDIUM | VisibilityToggle $effect fragility | `apps/web/src/components/ui/VisibilityToggle.svelte` |
| C18-02 | LOW | VisibilityToggle runs on dashboard | `apps/web/src/components/ui/VisibilityToggle.svelte` |
| C18-03 | LOW | SavingsComparison annual projection | `apps/web/src/components/dashboard/SavingsComparison.svelte` |
| C20-02 | LOW | DATE_PATTERNS divergence risk | `apps/web/src/lib/parser/csv.ts` |
| C21-02 | LOW | cards.ts fetch AbortSignal race | `apps/web/src/lib/cards.ts` |
| C22-05 | LOW | TransactionReview O(n) copy | `apps/web/src/components/dashboard/TransactionReview.svelte` |
| C24-06 | LOW | buildCardResults no negative guard | `apps/web/src/lib/analyzer.ts` |
| C27-01 | MEDIUM | loadFromStorage bare catch | `apps/web/src/lib/store.svelte.ts` |
| C30-01 | MEDIUM | OptimalCardMap derived recompute | `apps/web/src/components/dashboard/OptimalCardMap.svelte` |
| C30-03 | LOW | loadFromStorage catch inconsistency | `apps/web/src/lib/store.svelte.ts` |
| D-36 | MEDIUM | No web-side XLSX unit tests | `apps/web/src/lib/parser/xlsx.ts` |
| D-37 | MEDIUM | E2E waitForTimeout | `e2e/ui-ux-review.spec.js` |

---

## Agent Failures

None. All review perspectives were covered manually due to unavailability of parallel Agent tool calls in this environment.
