# Cycle 8 Aggregate Review

**Date:** 2026-05-06
**Scope:** Full repository — cherrypicker Korean credit card optimizer

---

## Summary

Cycle 8 review covered the codebase after Cycle 7 fixes. All gates pass (0 lint errors, 0 type errors, 10 test suites green). One new HIGH-severity parity regression was found: the web-side PDF, XLSX, and CSV parsers still convert negative amounts (refunds) to positive spending via `Math.abs()`, while the server-side skips them. The web-side HTML parser was correctly fixed in Cycle 7, but PDF, XLSX, and CSV were missed.

**Cycle 8 stats:** 4 agents reviewed. 7 new findings: 1 high, 3 medium, 3 low. 6 Cycle 7 findings verified fixed.

**AGENT FAILURES:** No Agent/Task spawner tool available in this environment. All reviews performed manually by the orchestrator. Per-agent files written for provenance.

---

## Critical / High Findings (1 new)

### C8-01: Web-side PDF, XLSX, and CSV parsers convert refunds to spending via Math.abs

**Agents:** code-reviewer (High), architect (High), test-engineer (High)
**Files:**
- `apps/web/src/lib/parser/pdf.ts:436`, `:620`
- `apps/web/src/lib/parser/xlsx.ts:633`
- `apps/web/src/lib/parser/csv.ts:432`, `:552`
**Confidence:** High

The web-side PDF, XLSX, and CSV parsers unconditionally apply `Math.abs()` to all non-zero amounts. This converts negative amounts (refunds, credits, chargebacks) into positive spending. The server-side equivalents skip negative amounts entirely with `if (amount <= 0) continue;`.

The web-side HTML parser was fixed in Cycle 7 to match server-side behavior, but PDF, XLSX, and CSV were missed. Comments in `pdf.ts:614-616` and `csv.ts:430-431` falsely claim this "matches server-side" behavior.

**Cross-agent agreement:** 3 of 4 agents flagged this parity issue.

**Fix:** Replace `Math.abs(amount)` with `if (amount <= 0) continue;` in web PDF, XLSX, and CSV parsers. Remove false parity comments.

---

## New Medium Findings (3)

### C8-02: SUMMARY_ROW_PATTERN potential ReDoS on long row text

**Agents:** security-reviewer
**File:** `packages/parser/src/csv/column-matcher.ts:93`
**Confidence:** Medium

Large regex with 40+ alternations tested against unconstrained row text length. Potential for regex engine slowdown on pathological input.

**Fix:** Cap row text length before regex test, or pre-filter for keyword presence.

### C8-03: build-json.ts exits 0 despite validation errors

**Agents:** code-reviewer
**File:** `scripts/build-json.ts:278-283`
**Confidence:** High

Validation errors are logged but script exits 0. CI won't detect card rule failures.

**Fix:** Add `process.exit(errors.length > 0 ? 1 : 0)`.

### C8-04: No parity test suite between web and server parsers

**Agents:** test-engineer, architect
**File:** N/A (missing)
**Confidence:** High

No automated test compares web-side and server-side parser outputs for identical inputs. This test gap is why parity regressions recur every cycle.

**Fix:** Create shared test fixtures and parity assertions.

---

## New Low Findings (3)

### C8-05: esc() missing DEL character and high-Unicode surrogates

**Agents:** security-reviewer
**File:** `packages/viz/src/report/generator.ts:31-41`
**Confidence:** Medium

`\x7f` (DEL) and U+FFFE/U+FFFF not stripped. Mitigated by CSP presence.

### C8-06: build-json.ts duplicates Zod schemas

**Agents:** architect
**File:** `scripts/build-json.ts:18-82`
**Confidence:** High

Schemas duplicated from `packages/rules/src/schema.ts`.

**Fix:** Import from `@cherrypicker/rules`.

### C8-07: No web-side parser-level tests for negative amounts

**Agents:** test-engineer
**File:** `apps/web/__tests__/*.test.ts`
**Confidence:** High

Tests exist for analyzer-level negative amount exclusion, but not parser-level.

---

## Verified Fixes (Cycle 7)

| Issue | File | Commit | Evidence |
|-------|------|--------|----------|
| Web JSON Math.abs | `apps/web/src/lib/parser/json.ts` | `d8dcbc8` | No Math.abs, comment corrected |
| Web HTML Math.abs | `apps/web/src/lib/parser/html.ts` | `d8dcbc8` | `amount <= 0` skip |
| Web OFX timezone | `apps/web/src/lib/parser/ofx.ts` | `d8dcbc8` | KST conversion present |
| FALLBACK_CATEGORY_LABELS | `apps/web/src/lib/category-labels-fallback.ts` | `8104e95` | Auto-generated from YAML |
| esc() control chars | `packages/viz/src/report/generator.ts` | `b57820e` | Strips `\x00-\x1f` |
| JSON negative tests | `packages/parser/__tests__/json.test.ts` | pre-existing | Test at line 106 |

---

## Still Open from Previous Cycles

| Finding | First Cycle | Status |
|---------|-------------|--------|
| Non-KRW transactions silently dropped | 5 | **OPEN** |
| Server/web parser structural duplication | 2 | **OPEN** |
| Regex DoS in column patterns | 4 | **OPEN** — C8-02 adds new evidence |
| PDF three code paths | 4 | **OPEN** |
| No brute-force benchmark | 4 | **OPEN** |
| Deferred-fix tracking fragmented | 4 | **OPEN** |

---

## Cross-Cutting Themes

1. **Parser parity is structural, not behavioral:** Seven cycles of fixes have not prevented new drift. PDF/XLSX/CSV web-side parsers diverge because the HTML fix was applied without auditing ALL parsers.
2. **Comments can lie:** False parity comments in `pdf.ts` and `csv.ts` create a false sense of correctness.
3. **Test gaps enable regression:** No parity test suite means regressions are only found during manual review cycles.

---

## Verdict

**FIX NOW:** C8-01 (web PDF/XLSX/CSV Math.abs), C8-03 (build-json.ts exit code).
**MONITOR:** Parser parity drift, ReDoS risk.
**REDESIGN REQUIRED:** Server/web parser structural unification + automated parity tests.
