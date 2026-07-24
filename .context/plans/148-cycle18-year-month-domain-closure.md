# Plan 148: Cycle 18 YearMonth Domain Closure

**Finding:** C18-001 (Low/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- `packages/core/src/analysis/context.ts:3` declares
  `` YearMonth = `${number}-${string}` ``, which accepts values rejected by
  the module's runtime predicate.
- `packages/core/src/analysis/context.ts:51-78` admits strict four-digit ISO
  dates from year 0100 onward and projects their exact `YYYY-MM` text.
- `packages/core/src/analysis/context.ts:80-91` converts the year to a number
  and interpolates it without restoring four-character width.
- For December `0999` plus January `1000`,
  `buildAnalysisContext()` searches for `999-12`, misses the valid preceding
  row, and records a missing-month zero basis.
- Fresh-result coherence derives the same malformed key, while persistence
  requires every stored month to pass `isYearMonth()`.
- Supported statement parsers independently restrict years to 1900–2100, so
  ordinary uploads are unaffected and severity remains Low.

## Domain decision

1. `YearMonth` is an opaque string refined by one runtime predicate/parser;
   arbitrary string literals are not statically valid months.
2. The runtime grammar remains exactly `YYYY-MM`, with years `0000`–`9999`
   and months `01`–`12`.
3. Every representable predecessor remains in that grammar.
4. `0000-01` has no representable four-digit predecessor and throws an
   explicit range error rather than returning an asserted malformed value.
5. Parser policy remains narrower (1900–2100) and is not broadened by this
   shared-core contract repair.

## Implementation

1. Replace the loose public template alias with an opaque branded
   `YearMonth`.
2. Add and export one `parseYearMonth(value: string)` constructor that uses
   `isYearMonth()` and returns the brand or throws the existing invalid-value
   error.
3. Make `yearMonthOfDate()` and `previousCalendarMonth()` construct results
   through the same checked boundary; remove unchecked `as YearMonth`
   assertions.
4. Preserve `yearText` for same-year predecessors and pad a decremented
   January year to exactly four digits.
5. Detect `0000-01` before decrementing and throw an exact documented range
   error.
6. Re-export the constructor from the core root and the web analysis-context
   facade.
7. Add a compile-time contract assertion that malformed raw literals are not
   assignable to `YearMonth`.
8. Add table-driven runtime closure cases for leading-zero same-year months,
   January `0100`, January `1000`, modern controls, malformed input, and
   `0000-01`.
9. Add a full-context December-0999/January-1000 regression proving exact
   previous-row selection, statement-month provenance, monthly ordering, and
   unchanged transaction identity.
10. Preserve the Cycle 17 one-date-proof count and all current invalid-date,
    period, total, and safe-integer behavior.

## Acceptance

- [ ] Raw strings rejected by `isYearMonth()` are not assignable to the
      public `YearMonth` type without parsing/narrowing.
- [ ] Every successfully returned predecessor passes `isYearMonth()`.
- [ ] Same-year predecessors in 0100–0999 retain all four year digits.
- [ ] `1000-01` returns `0999-12` and selects a present December-0999 row.
- [ ] `0000-01` fails with the explicit lower-bound error.
- [ ] Modern parser, browser, CLI, coherence, disclosure, and persistence
      behavior remains unchanged.
- [ ] The deterministic one-proof-per-row regression still passes.

## Verification

The requested `ralph` capability is unavailable. Prompt 3 will use the
approved disciplined manual plan-to-test fallback: add focused failing
regressions, implement the smallest root fix, run the focused core/web
calendar suites, then run every required repository gate:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Use the repository E2E ownership preflight and postflight checks. Do not
deploy.
