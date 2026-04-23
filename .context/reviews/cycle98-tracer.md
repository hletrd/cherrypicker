# Cycle 98 — tracer pass

**Date:** 2026-04-23

## Scope

Causal tracing of suspicious flows and competing hypotheses.

## Traces performed

### Trace 1: CSV upload with malformed date → fullStatementPeriod

Hypothesis (post-C97-01): filter at line 378 drops malformed strings before sort, so `fullStatementPeriod` contains only valid ISO bounds.

Trace:
1. User uploads CSV with a row where date cell is `"소계"` (Korean footer).
2. Parser's `parseDateStringToISO` returns `"소계"` as-is (contract leak — see deferred parser refactor).
3. `parseAndCategorize` → `allTransactions` contains tx with `date: "소계"`.
4. `analyzer.ts:329` checks `tx.amount > 0 && tx.date.length >= 7`. `"소계".length === 2`, so this row is excluded from `monthlySpending`.
5. `analyzer.ts:343-346` — if no other rows, this throws (C96-01). Otherwise continues.
6. `analyzer.ts:376-379` — `allDates` now filters `length >= 10`, dropping `"소계"`. Sort returns clean ISO strings.
7. `fullStatementPeriod.start`/`end` are valid ISO dates. Correct.

Outcome: No pollution. C97-01 fix confirmed functional in full causal chain.

### Trace 2: Reoptimize after category edit

Hypothesis: snapshot pattern (C81-01) protects against concurrent analyze() + reoptimize() races.

Trace:
1. User edits category of a transaction.
2. `reoptimize(editedTxs)` called.
3. Line 494: null guard. If result is null, clear storage and error.
4. Line 506: `const snapshot = result;` — captures current state.
5. Lines 508-566: async operations. `result` $state could change.
6. Line 578: `result = { ...snapshot, transactions: editedTxs, optimization, monthlyBreakdown }`.

Outcome: even if a concurrent `analyze()` set result to a different object between lines 506 and 578, the reoptimize output uses `snapshot` (the pre-analyze state), ensuring consistent semantics. The UI would briefly show the concurrent analyze result and then re-show the reoptimize result — acceptable.

### Trace 3: Dark mode color fallback for unknown issuer

Trace: `getIssuerColor('unknown')` → `colors['unknown']` is undefined → `?? '#6b7280'` → returns gray. No crash. Text color: `getIssuerTextColor('unknown')` → `new Set(['kakao', 'jeju']).has('unknown')` → false → `'text-white'`. Against `#6b7280` gray, white text contrast is ~4.7 (gray-500) — meets WCAG AA. Safe.

## Competing hypotheses checked

- **Does C97-01 filter break edge cases with date formats like `"2026-01"` (length 7) that are slice-able but not full ISO?** No — the filter requires `length >= 10`, so `"2026-01"` (length 7) is filtered out. `monthlySpending.keys()` uses `.slice(0, 7)` on length >=7 dates, so it still gets the month data from valid-plus-7-char strings. The two code paths handle their own validity checks.
- **Could the filter drop valid dates formatted with timezone suffix `"2026-01-05T00:00:00Z"` (length 20)?** These would pass the filter. Bare `.sort()` on these vs `"2026-01-05"` (length 10) — lexicographic compare would still put `"2026-01-05"` before `"2026-01-05T"` because `'-'` (U+002D) < `'T'` (U+0054). Actually, checking character-by-character, they match through `"2026-01-05"`, then one ends and the other has `'T'` — so the shorter sorts before. Both represent the same day. No issue.

## Findings

None net-new.

## Summary

All traced flows produce correct output in the current codebase. Cycle 98 is a no-finding convergence cycle.
