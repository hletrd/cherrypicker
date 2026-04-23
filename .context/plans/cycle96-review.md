# Cycle 96 Plan — C96-01 Analyzer Empty-Months Guard

**Date:** 2026-04-23
**Context:** Cycle 2/100 of this orchestrator run; cycle 96 of repo-numbered review history.

---

## Summary

Cycle 96's multi-agent fan-out (11 reviewer passes: code-reviewer, perf-reviewer, security-reviewer, debugger, test-engineer, tracer, architect, verifier, designer, document-specialist, critic) produced **1 new actionable finding** (C96-01, MEDIUM severity, HIGH confidence). This breaks the 8-cycle convergence streak (88-95) with a genuine net-new issue.

---

## New Findings Addressed

### C96-01: `analyzer.ts:337` non-null assertion on empty months array causes silent empty-result failure (MEDIUM, HIGH confidence)

**File:** `apps/web/src/lib/analyzer.ts:336-338`

**Problem:** `const latestMonth = months[months.length - 1]!` relies on an invariant (`months.length > 0`) that isn't enforced when every transaction in `allTransactions` has an unparseable date. The parser layer's `parseDateStringToISO` returns the raw input when no format matches (with a parse error logged), so unparseable-date transactions survive to the analyzer. The analyzer's length-guard at line 323 then filters them out of `monthlySpending`, leaving `months = []`, `latestMonth = undefined`, and the optimizer silently returning empty assignments as "success".

**Concrete failure scenario:** A user uploads a CSV with non-standard date formatting (e.g., dates as `'2026-'`, empty strings, or other short/malformed values that don't match `parseDateStringToISO`'s known formats). The upload appears to succeed, the dashboard shows blank results with no error banner, and the user has no signal about what went wrong.

**Plan:**
1. Add an explicit length check before `months[months.length - 1]!` that throws a Korean-language error if `months` is empty.
2. Use the same error-message pattern as the sibling error at `analyzer.ts:311`.
3. Add a regression test in `apps/web/__tests__/analyzer-adapter.test.ts` asserting that `monthlySpending` is empty when every transaction has a date shorter than 7 chars.

**Implementation:**

```ts
// apps/web/src/lib/analyzer.ts (analyzeMultipleFiles, near line 336)
const months = [...monthlySpending.keys()].sort();
if (months.length === 0) {
  throw new Error('거래 내역의 날짜를 해석할 수 없어요. 파일 형식을 확인해 주세요.');
}
const latestMonth = months[months.length - 1]!;
```

**Status:** **IMPLEMENTED AND VERIFIED** — fix + test committed; `bun run verify --force` green (10/10 tasks, 137 workspace tests); `bun run build` green (7/7 tasks).

---

## Previously Implemented Items (Verified This Cycle)

- C1-01, C1-12, C7-01, C44-01, C81-01, C82-01, C92-01, C94-01, C72-02, C72-03 — all still in place.

---

## Deferred Findings

All prior deferred findings from cycle 95 remain deferred with the same severity and exit criteria. No new deferrals this cycle.

### Architect-flagged follow-up candidate (not a deferral, a future refactor)

**Parser → analyzer contract tightening.** `parseDateStringToISO` returns `string` unconditionally, relying on heuristics (length checks, ISO regex) to signal failure downstream. A cleaner design would use `string | null` or a tagged return (`{ ok: true; date: string } | { ok: false; raw: string }`). This would let the analyzer pattern-match on parse failure instead of approximating it with `tx.date.length < 7`. Classified as MEDIUM effort; defer to a dedicated refactor cycle.

---

## Archived Plans (Fully Implemented)

All prior cycle plans through cycle 95 remain fully implemented.

---

## Gate Status

- `bun run verify --force` — 10/10 turbo tasks successful (cache bypass). Tests: core 95, rules 37, viz 1, cli 4 — all pass.
- `bun test apps/web/__tests__/analyzer-adapter.test.ts` — 23/23 pass (includes the new C96-01 regression test).
- `bun run build` — 7/7 turbo tasks successful (6 cached, 1 web rebuild). Pre-existing chunk-size warning unchanged.
- `bun run test:e2e` — not run this cycle (fix is an error-path addition; no happy-path UI change).

GATE_FIXES: 1 (C96-01).

---

## Cycle Conclusion

Cycle 96 surfaces 1 net-new finding and fixes it inline, reinforcing the discipline that apparent convergence doesn't mean zero risk. The review loop continues to add value.

This cycle reports `NEW_FINDINGS=1, NEW_PLANS=1 (this file), COMMITS=1+ (fix + test + docs), GATE_FIXES=1, DEPLOY=none`.
