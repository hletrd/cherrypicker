# Review Aggregate — Cycle 97 (2026-04-23)

**Cycle:** 97 of repo-numbered review history (cycle 3/100 of this orchestrator run)
**Scope:** Full repository with emphasis on net-new issues since cycle 96.
**Reviewer fan-out:** code-reviewer, perf-reviewer, security-reviewer, debugger, test-engineer, tracer, architect, verifier, designer, document-specialist, critic (11 reviewer passes).

---

## Source Files (This Cycle)

- `.context/reviews/cycle97-code-reviewer.md`
- `.context/reviews/cycle97-perf-reviewer.md`
- `.context/reviews/cycle97-security-reviewer.md`
- `.context/reviews/cycle97-debugger.md`
- `.context/reviews/cycle97-test-engineer.md`
- `.context/reviews/cycle97-tracer.md`
- `.context/reviews/cycle97-architect.md`
- `.context/reviews/cycle97-verifier.md`
- `.context/reviews/cycle97-designer.md`
- `.context/reviews/cycle97-document-specialist.md`
- `.context/reviews/cycle97-critic.md`

---

## Executive Summary

**Total new findings: 2** (both LOW severity). One is HIGH confidence and actionable inline (C97-01); the other is MEDIUM confidence and deferred (C97-02).

Cycle 97 continues the theme from cycle 96 — the parser → analyzer date-validity contract remains the root cause, producing multiple downstream symptoms. Cycle 96 fixed the fully-unparseable symptom (C96-01); cycle 97 surfaces and fixes the partially-unparseable symptom (C97-01).

After cycle 96 broke the 8-cycle convergence streak (88-95), cycle 97 extends the "real findings after apparent convergence" pattern.

---

## Per-Agent Results

| Reviewer | New Findings | Notes |
|---|---|---|
| code-reviewer | 1 (C97-01) + 1 (C97-02) | `allDates` unfiltered sort; reoptimize latestMonth/months mismatch. |
| perf-reviewer | 0 | No hot-path impact; fix is O(n) additive. |
| security-reviewer | 0 | No XSS/secret/auth changes. |
| debugger | 1 (C97-01 shared) | Same bug surfaced with additional failure repro (Korean footer rows). |
| test-engineer | 1 (C97-T01, supporting) | Coverage gap for mixed-validity dates; to be added alongside fix. |
| tracer | 1 (C97-01 shared) | Causal trace; severity confirmed LOW after discovering formatPeriod graceful degradation. |
| architect | 0 | Notes cycle 96's parser refactor flag remains relevant. |
| verifier | 0 | All prior claims verified; C97-01 is a real reachable bug. |
| designer | 0 | No UX regression; graceful degradation is acceptable. |
| document-specialist | 0 | No doc drift. |
| critic | 0 new; skeptical acceptance of C97-01 (fix this cycle), C97-02 (defer). |

**Cross-agent agreement:** 3 reviewers (code-reviewer, debugger, tracer) flag C97-01. Verifier and critic concur. Strong consensus.

---

## New Findings (Detail)

### C97-01: `allDates` unfiltered sort produces malformed `fullStatementPeriod` when upload contains mixed valid/invalid dates (LOW, HIGH confidence)

**File:** `apps/web/src/lib/analyzer.ts:369-377`
**Severity:** LOW (UI gracefully degrades to `'-'`; persisted state is polluted but not user-visible)
**Confidence:** HIGH
**Flagged by:** code-reviewer, debugger, tracer

**Problem.** After C96-01 hardened the fully-unparseable case, the mixed case still slips through. `allTransactions` contains transactions with non-ISO date strings (short, Korean footer, misc parser fallback). The `.filter(Boolean)` keeps any non-empty string. The bare `.sort()` does lexicographic sort, placing short/non-ISO strings before valid ISO dates (e.g., `"2026-"` < `"2026-01-05"`, `"소계"` > `"2026-12-31"` due to Unicode codepoints). Result: `fullStatementPeriod.start` or `.end` becomes a malformed string.

**Reachability.** A CSV/XLSX with any statement-footer row (e.g., `"소계"`/`"합계"` summary line) or stray short dates. Korean bank CSVs commonly have such rows leaked through row-level detection.

**Current mitigation.** `SpendingSummary.formatPeriod()` and `ReportContent.formatYearMonthKo()` both gracefully degrade to `'-'` when a bound is malformed. So the user sees `'-'` for the period rather than garbled text. Effect is LOW severity.

**Why fix.** Defense-in-depth. Avoids polluting sessionStorage with garbage strings. Makes future consumers safe without requiring each to call a graceful formatter.

**Fix.** Filter `allDates` and `optimizedDates` to valid ISO strings (`length >= 10`) before sort:

```ts
// analyzer.ts:369-377
const allDates = allTransactions
  .map(tx => tx.date)
  .filter((d): d is string => typeof d === 'string' && d.length >= 10)
  .sort();

const optimizedDates = latestTransactions
  .map(tx => tx.date)
  .filter((d): d is string => typeof d === 'string' && d.length >= 10)
  .sort();
```

**Test added alongside fix (C97-T01).** Regression test in `analyzer-adapter.test.ts` asserting that mixed ISO + non-ISO date arrays filter correctly.

**Status:** SCHEDULED for this cycle.

---

### C97-02: `reoptimize()` latestMonth/months semantic mismatch in refund-only-latest-month edge case (LOW, MEDIUM confidence)

**File:** `apps/web/src/lib/store.svelte.ts:557-566`
**Severity:** LOW (no incorrect output; fallback is correct)
**Confidence:** MEDIUM (edge case; unclear if user can realistically produce it)
**Flagged by:** code-reviewer

**Problem.** `getLatestMonth()` includes all transaction dates; `updatedMonthlyBreakdown` (and thus `months`) only includes months with positive amounts. If the user edits their way into a refund-only latest month, `months.indexOf(latestMonth)` returns -1, the `latestIdx > 0` guard is false, and `previousMonthSpending` stays undefined — the optimizer falls back to per-card exclusion-filtered spending.

**Impact.** No incorrect output. The fallback path is a correct behavior. This is a code-smell (divergent definitions of "latest month" across the codebase) rather than a bug with user-visible consequences.

**Status:** DEFERRED. Exit criterion: if any future change makes the reoptimize fallback path produce incorrect output, re-open.

---

## Cross-Agent Confidence Matrix

| Finding | CR | Perf | Sec | Dbg | Test | Trc | Arch | Vfy | Des | Doc | Crit | Signal |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C97-01 | HIGH | — | — | HIGH | HIGH | MED | — | HIGH | — | — | HIGH | Strong |
| C97-02 | MED | — | — | — | — | — | — | — | — | — | MED | Weak |

---

## Verified Prior Fixes (Sampled)

| Finding | Status | Evidence |
|---|---|---|
| C96-01 analyzer empty-months throw | CONFIRMED | `analyzer.ts:344-346` |
| C94-01 formatSavingsValue helper | CONFIRMED | `formatters.ts:224-227` |
| C1-01 monthlySpending positive-only | CONFIRMED | `analyzer.ts:329`, `store.svelte.ts:531` |
| C1-12 findRule secondary sort | CONFIRMED | `reward.ts:90-94` |
| C7-01 generation init from storage | CONFIRMED | `store.svelte.ts:361` |
| C72-02 / C72-03 empty-array cache poison | CONFIRMED | `analyzer.ts:193-195`, `store.svelte.ts:393-397` |

---

## Deferred Findings

All prior deferred items (D-01 through D-111 in `.context/plans/00-deferred-items.md`) remain deferred with severity preserved and exit criteria unchanged.

**New deferrals this cycle:** 1 (C97-02 per above).

The architect's flagged follow-up (parser return-type refactor) remains deferred with the same exit criterion as cycle 96.

---

## Still-Open Actionable Items (LOW, carried forward)

Unchanged from cycle 96:

| Priority | ID | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | C1-N01 | formatIssuerNameKo 24-entry hardcoded map drifts from YAML | Medium | Correctness |
| 2 | C1-N02 | CATEGORY_COLORS 84-entry hardcoded map drifts from YAML | Medium | Correctness |
| 3 | C1-N04 | Web parser CSV helpers duplicated from server shared.ts | Large | Maintenance |
| 4 | C89-03 | formatters.ts m! non-null assertion after length check | Small | Type safety |

---

## Agent Failures

None. All 11 reviewer passes returned successfully.

---

## Convergence Note

Cycle 97 finds 2 net-new issues (1 actionable, 1 deferred). The pattern from cycle 96 repeats: apparent convergence masks latent issues in the parser → analyzer contract. The loop is still producing value; the root-cause refactor (deferred) would retire both C96-01 and C97-01 plus protect against future symptoms.

---

## Gate Status (to be finalized after C97-01 fix)

- `bun run verify`: expected green (fix is additive; test added).
- `bun run build`: expected green (no API changes).
- `bun run test:e2e`: not run (error-path UI already degrades gracefully; no happy-path change).

GATE_FIXES this cycle: 1 (C97-01).
