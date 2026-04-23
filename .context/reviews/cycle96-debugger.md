# Cycle 96 — debugger pass

**Date:** 2026-04-23

## New Findings

### C96-01 (shared with code-reviewer): silent empty-result failure when all dates unparseable

Same reproduction as `cycle96-code-reviewer.md`. The debugger lens:

**Latent bug class.** Non-null assertion (`!`) used to paper over an invariant (`months.length > 0`) that can actually be violated by upstream parser behavior (unparseable dates pass through with the raw string). This is exactly the pattern that `--noUncheckedIndexedAccess` would catch at compile time if enabled, and which a defensive length check catches at runtime.

**Related patterns audited (no new findings):**
- `analyzer.ts:361` `allDates[0]!` — guarded by `allDates.length > 0` ternary. Safe.
- `analyzer.ts:366` `optimizedDates[0]!` — guarded similarly. Safe.
- `analyzer.ts:265` `sorted[sorted.length - 1] ?? null` — correct.
- `store.svelte.ts:555` `snapshot.previousMonthSpendingOption !== undefined` — correct.

Only `months[months.length - 1]!` at line 337 and `months[months.length - 2]!` at line 338 were relying on an unverified invariant. The first is now gated by the explicit length-check throw; the second is still `!`-asserted but only evaluated when `months.length >= 2`, so it remains safe.

No other latent bugs surfaced this cycle.
