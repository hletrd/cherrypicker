# Cycle 97 — debugger pass

**Date:** 2026-04-23

## Scope

Latent-bug-class sweep, with emphasis on the area adjacent to C96-01 (analyzer.ts and statement period construction).

## Findings

### Shared with code-reviewer: C97-01 fullStatementPeriod malformed under mixed date parsing (LOW, HIGH confidence)

**File:** `apps/web/src/lib/analyzer.ts:369-372`

Re-derivation from the latent-bug-class angle: after cycle 96 hardened the fully-unparseable case, the half-unparseable case still makes it through. `allTransactions.map(tx => tx.date).filter(Boolean)` keeps any non-empty string, and the subsequent `.sort()` without a comparator does a JS lexicographic sort. For mixed data (one malformed row, many valid rows), `fullStatementPeriod.start` receives the malformed string.

**Failure mode.** Silent malformed UI render. `SpendingSummary.formatPeriod` gracefully returns `'-'` for a malformed half, but the combined display "- ~ 2026년 3월" is surprising and doesn't match the actual data.

**Repro scenario.**
1. Upload a CSV with one row where the date cell is `"소계"` (Korean for "subtotal" — a common statement-footer artifact that can leak through row detection).
2. Parser's `parseDateStringToISO` returns `"소계"` as-is (no format matches).
3. analyzeMultipleFiles includes it in `allTransactions`. `monthlySpending` skips it because `"소계".length === 2 < 7`. But `allDates` keeps it.
4. `.sort()` places `"소계"` after ISO dates (Korean characters have higher Unicode codepoints than digits), so `fullStatementPeriod.end = "소계"`, displaying as `"-"` in the end slot.

I have strong evidence this is reachable — Korean statement files commonly have summary/footer rows.

**Fix.** Same as C97-01 in code-reviewer doc — filter `allDates` to `length >= 10` before sort.

---

## Commonly-missed-issues sweep

- **`Array.prototype.sort()` without comparator on mixed-length strings.** One hit found (C97-01). No others.
- **`undefined` slipping through non-null assertions.** `date-utils.ts` uses `!` on regex captures — safe because `exec()`/`match()` non-null implies the capture group exists.
- **`Map.get()` default-to-undefined paths.** All checked: `monthlySpending.get(previousMonth)!` at analyzer.ts:354 — `previousMonth` is from `months[months.length - 2]!` which is in `monthlySpending.keys()` by construction, so `.get()` is guaranteed defined. Safe.
- **Race conditions.** `analyzer.ts` uses `Promise.all` on `files.map(...)` which is concurrent but each `parseAndCategorize` is pure (shared matcher is read-only). Safe.

## Summary

1 shared finding with code-reviewer (C97-01). No other latent bugs this pass.
