# Cycle 6 Review — 2026-04-22

## Scope
Deep code review beyond refund-filtering theme. Focus: logic bugs, edge cases, test fidelity, type safety, UI issues.

## Areas Reviewed
- packages/core/src/ (optimizer, calculator, categorizer, models)
- apps/web/src/ (analyzer, formatters, store, parser, components)
- packages/viz/src/ (report generator, terminal summary)
- packages/rules/src/ (schema, loader, types)
- tools/cli/src/ (commands)

## Findings

| ID | Finding | Severity | File | Confidence | Status |
|---|---|---|---|---|---|
| C6-01 | Test uses Math.abs(tx.amount) for monthlySpending while production uses tx.amount > 0 filter — test logic diverges from production and no negative-amount fixture exists to verify the filter | MEDIUM | `apps/web/__tests__/analyzer-adapter.test.ts:240,286` | High | **OPEN** |

### C6-01 Detail

**Production code** (`apps/web/src/lib/analyzer.ts:329-330`):
```ts
if (tx.amount > 0) {
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
}
```

**Test code** (`apps/web/__tests__/analyzer-adapter.test.ts:240`):
```ts
monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + Math.abs(tx.amount));
```

The test uses `Math.abs()` which would include negative-amount transactions as positive spending, while production correctly filters them out with `tx.amount > 0`. If a negative-amount transaction were added to the test fixtures, the test would pass incorrectly (including the refund in spending) while production would correctly exclude it. The test should match production's filter logic: `if (tx.amount > 0)` before accumulating.

The same issue appears at line 286 in a second test for previous-month spending computation:
```ts
.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
```

This should also filter to positive amounts only and drop `Math.abs()`.

**Fix**: Change both test locations to use `tx.amount > 0` filter matching production, and add a negative-amount test fixture to verify the filter.
