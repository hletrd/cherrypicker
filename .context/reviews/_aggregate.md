# Cycle 7 Aggregate Review

**Date:** 2026-05-06
**Scope:** Full repository — cherrypicker Korean credit card optimizer

---

## Summary

Cycle 7 review covered the codebase after Cycle 6 fixes. All gates pass (0 lint errors, 0 type errors, 10 test suites green). However, one new HIGH-severity parity regression was found: the web-side JSON parser still takes `Math.abs()` on negative amounts, contradicting the server-side fix from Cycle 6. Two additional MEDIUM parity divergences identified in HTML and OFX web parsers.

**Cycle 7 stats:** 7 agents reviewed. 6 new findings: 1 critical/high, 3 medium, 2 low. 3 Cycle 6 findings verified fixed, 1 Cycle 6 finding partially fixed (web-side not updated).

**AGENT FAILURES:** No Agent/ Task spawner tool available in this environment. All reviews performed manually by the orchestrator. Per-agent files written for provenance.

---

## Critical / High Findings (1 new)

### C7-01: Web-side JSON parser still converts refunds to purchases via Math.abs

**Agents:** code-reviewer (High), architect (High), debugger (High), tracer (High), verifier (REFUTED), document-specialist (High)
**File:** `apps/web/src/lib/parser/json.ts:101`
**Confidence:** High

The server-side JSON parser was fixed in commit `fcd398b` (Cycle 6) to preserve negative amounts. The web-side parser at line 101 still does `const absAmount = Math.abs(amount)` and uses `absAmount` at line 111. The comment at lines 98-99 falsely claims this "matches server-side JSON parser behavior (C100-02)."

**Cross-agent agreement:** 6 of 7 agents flagged this or a related parity issue.

**Fix:** Remove `Math.abs()`. Use `amount` directly, matching server-side at `packages/parser/src/json/index.ts:114-124`.

---

## New Medium Findings (3)

### C7-02: Web-side HTML parser diverges from server on negative amounts

**Agents:** code-reviewer, debugger, tracer
**File:** `apps/web/src/lib/parser/html.ts:223`
**Confidence:** High

Web-side does `amount: Math.abs(amount)` while server-side uses `if (amount <= 0) continue;`. Different semantics: web converts negatives to positives, server skips them.

**Fix:** Align web-side with server-side — skip non-positive amounts.

### C7-03: Web-side OFX parser lacks timezone handling

**Agents:** architect, debugger
**File:** `apps/web/src/lib/parser/ofx.ts:43-49`
**Confidence:** Medium

Server-side has KST conversion (`packages/parser/src/ofx/index.ts:75-102`). Web-side strips non-digits and returns raw. Same OFX file produces different dates.

**Fix:** Share server-side `parseOFXDate` implementation.

### C7-04: `FALLBACK_CATEGORY_LABELS` duplicates taxonomy

**Agents:** architect, critic, designer, perf-reviewer, document-specialist
**File:** `apps/web/src/lib/category-labels.ts:25-103`
**Confidence:** High

78-entry hardcoded Map recreates the `CATEGORY_NAMES_KO` anti-pattern that Cycle 6 eliminated. Comment admits "Must be updated in lockstep with categories.yaml taxonomy."

**Fix:** Import `buildCategoryLabelMap` from `@cherrypicker/rules` or generate fallback at build time.

---

## New Low Findings (2)

### C7-05: HTML report `esc()` still incomplete

**Agents:** security-reviewer
**File:** `packages/viz/src/report/generator.ts:31-40`
**Confidence:** Medium

Still handles only 7 entities plus null byte. Missing control character handling. Missing CSP meta tag.

### C7-06: No tests for JSON negative amount preservation

**Agents:** test-engineer
**File:** `packages/parser/__tests__/json.test.ts`
**Confidence:** High

T6-03 from Cycle 6 remains unaddressed. No automated verification that negative amounts are preserved.

---

## Verified Fixes (Cycle 6)

| Issue | File | Commit | Evidence |
|-------|------|--------|----------|
| ParseError class parity | `apps/web/src/lib/parser/types.ts` | `c55005d` | class extends Error, instanceof works |
| buildCategoryLabelMap extraction | `packages/rules/src/category-names.ts` | `88836e7` | Map return, used in CLI + web |
| Path validation hardened | `tools/cli/src/validation.ts` | `ea98316` | null bytes stripped, symlinks rejected |
| LLM consent localized | `tools/cli/src/consent.ts` | `2f3a3ee` | Korean prompt, 30s timeout |
| Anthropic model updated | `packages/parser/src/pdf/llm-fallback.ts` | `86100a8` | `claude-3-7-sonnet-latest` |
| JSON negative amounts (server) | `packages/parser/src/json/index.ts` | `fcd398b` | preserves negatives |

---

## Still Open from Previous Cycles

| Finding | First Cycle | Status |
|---------|-------------|--------|
| Non-KRW transactions silently dropped | 5 | **OPEN** |
| Server/web parser structural duplication | 2 | **OPEN** |
| HTML report `esc()` incomplete | 4 | **OPEN** |
| Regex DoS in column patterns | 4 | **OPEN** |
| PDF three code paths | 4 | **OPEN** |
| Missing CSP in HTML reports | 5 | **OPEN** |
| No brute-force benchmark | 4 | **OPEN** |
| Deferred-fix tracking fragmented | 4 | **OPEN** |

---

## Cross-Cutting Themes

1. **Parser parity is structural, not behavioral:** 6+ cycles of behavioral parity fixes have not prevented drift. The only lasting fix is structural unification.
2. **Duplication regenerates:** `FALLBACK_CATEGORY_LABELS` is `CATEGORY_NAMES_KO` reborn. Shared utilities only work if ALL call sites use them.
3. **Comments can lie:** The false comment at `json.ts:98-99` misled maintainers about server-side behavior. Code comments claiming parity must be verified.
4. **Test gaps enable regression:** T6-03 (no negative amount tests) meant the web-side parity regression was not caught by CI.

---

## Verdict

**FIX NOW:** C7-01 (web JSON Math.abs), C7-02 (web HTML Math.abs), C7-04 (FALLBACK_CATEGORY_LABELS duplication).
**MONITOR:** Parser parity drift, OFX timezone handling.
**REDESIGN REQUIRED:** Server/web parser structural unification remains the highest-value architectural investment.
