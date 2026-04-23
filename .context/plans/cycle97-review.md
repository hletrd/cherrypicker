# Cycle 97 Plan — C97-01 fullStatementPeriod Filter & C97-02 Deferral

**Date:** 2026-04-23
**Context:** Cycle 3/100 of this orchestrator run; cycle 97 of repo-numbered review history.

---

## Summary

Cycle 97's multi-agent fan-out (11 reviewer passes) produced **2 new findings** — 1 actionable inline (C97-01, LOW severity, HIGH confidence) and 1 deferred (C97-02, LOW severity, MEDIUM confidence). This continues the cycle 96 pattern of surfacing real issues after apparent convergence.

---

## Scheduled Fixes (this cycle)

### C97-01: `analyzer.ts` fullStatementPeriod and statementPeriod constructed from unfiltered date strings

**File:** `apps/web/src/lib/analyzer.ts:369-377`

**Problem.** `allDates = allTransactions.map(tx => tx.date).filter(Boolean).sort()` retains any non-empty string, including short/non-ISO strings that parsers returned as-is after a failed match. Bare `.sort()` places these before valid ISO dates, contaminating `fullStatementPeriod.start`. Same risk applies to `optimizedDates`. The UI degrades gracefully (formatPeriod returns `'-'`), but sessionStorage retains garbage strings.

**Flagged by.** code-reviewer, debugger, tracer, verifier, critic.

**Severity.** LOW. **Confidence.** HIGH. **Reachability.** Medium — triggered by any CSV with a malformed row (Korean footer/summary lines are common).

**Plan.**
1. Filter both `allDates` and `optimizedDates` to strings with `length >= 10` (valid `YYYY-MM-DD`) before sort.
2. Add a regression test in `apps/web/__tests__/analyzer-adapter.test.ts` covering the mixed-validity case.
3. Run gates: `bun run verify`, `bun run build`.

**Implementation.**

```ts
// apps/web/src/lib/analyzer.ts, replacing lines 369-377

// Filter to valid ISO (YYYY-MM-DD, length 10) dates before sorting.
// Short/non-ISO strings that parsers returned as-is (e.g., "소계" footer
// rows, short "2026-" truncations) would otherwise sort ahead of valid
// ISO dates lexicographically and corrupt the period bounds (C97-01).
const allDates = allTransactions
  .map(tx => tx.date)
  .filter((d): d is string => typeof d === 'string' && d.length >= 10)
  .sort();
const fullStatementPeriod = allDates.length > 0
  ? { start: allDates[0]!, end: allDates[allDates.length - 1]! }
  : undefined;

const optimizedDates = latestTransactions
  .map(tx => tx.date)
  .filter((d): d is string => typeof d === 'string' && d.length >= 10)
  .sort();
const statementPeriod = optimizedDates.length > 0
  ? { start: optimizedDates[0]!, end: optimizedDates[optimizedDates.length - 1]! }
  : undefined;
```

**Status.** SCHEDULED for this cycle.

---

## Deferred Items (this cycle's review)

Per the STRICT deferred-fix rules in the orchestrator brief, each deferred finding records: file+line citation, original severity/confidence (not downgraded), concrete reason for deferral, and exit criterion.

| ID | File+Line | Severity | Confidence | Reason for Deferral | Exit Criterion |
|---|---|---|---|---|---|
| C97-02 | `apps/web/src/lib/store.svelte.ts:557-566` | LOW | MEDIUM | Edge case requires user to edit their way into a refund-only latest month. No incorrect output today — fallback path is correct behavior. Fixing inline would conflate concerns with C97-01. | If any future change causes the reoptimize fallback path to produce user-visible incorrect output, re-open with a regression test. |

**Repo-policy check for deferral:** This is a LOW-severity finding with no security/correctness/data-loss implication. No repo rule (CLAUDE.md, AGENTS.md, .context/**) prohibits deferral of LOW-severity findings. When picked up, the eventual fix will follow all repo commit rules (GPG-signed, conventional + gitmoji, no `--no-verify`).

---

## Previously Implemented Items (Verified This Cycle)

- C1-01, C1-12, C7-01, C44-01, C81-01, C82-01, C92-01, C94-01, C96-01, C72-02, C72-03 — all still in place.

---

## Previously Deferred Items (Unchanged)

All items from `00-deferred-items.md` (D-01 through D-111) remain deferred with same severity and exit criteria.

The cycle 96 architect's follow-up candidate (parser return-type refactor: `parseDateStringToISO` returning `string | null`) remains deferred — this cycle's C97-01 fix adds a second symptomatic guard, which is acceptable as a narrow fix. The root-cause refactor is still a MEDIUM-effort dedicated cycle's worth of work.

---

## Archived Plans (Fully Implemented)

All prior cycle plans through cycle 96 remain fully implemented.

---

## Gate Plan

- `bun run verify --force` — expected green.
- `bun run build` — expected green.
- `bun run test:e2e` — not run this cycle (happy-path UI already degrades gracefully; no behavioral change).

GATE_FIXES this cycle: 1 (C97-01 — a latent correctness/persistence issue surfaced and fixed).

---

## Commit Plan

One fine-grained commit per spec of the orchestrator + repo rules:

1. `fix(analyzer): 🐛 filter non-ISO dates from fullStatementPeriod construction (C97-01)` — combines the 2-line filter fix and the regression test, since the test directly validates the fix. GPG-signed. No co-author line. No `--no-verify`.
2. `docs(reviews): 📝 add cycle 97 multi-agent reviews, aggregate, and plan — fix fullStatementPeriod ISO filter (C97-01)` — all review/plan docs.

---

## Cycle Conclusion

Cycle 97 surfaces 2 findings, fixes 1, defers 1 with a clear exit criterion. The review loop continues to find real issues — both C96-01 and C97-01 are symptoms of the same deferred root cause (parser return-type contract).
