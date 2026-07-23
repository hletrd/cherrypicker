# Review-plan-fix Cycle 8 — test engineer

**Review baseline:** `3fd993d471a8676170031f20715f6a53c99e8a9f`

## Inventory and test strategy coverage

The locked snapshot contains 2,199 tracked paths, including 203 production
code paths and 151 tracked test paths. Test/config review covered every
workspace package script, root `package.json`, `bunfig.toml`,
`vitest.config.ts`, both Playwright configurations, Turbo configuration, CI,
the 122 unit/spec source files, 16 E2E paths, script tests, fixtures, generated
catalog gates, and historical test findings. Production-to-test mapping
covered parser parity, upload/worker/analyzer flows, categorization,
calculator/optimizer, persistence, UI model helpers, CLI/scraper commands,
catalog schema/publication, and documentation checks.

The complete skip/only/todo/fixme and conditional-assertion scan found no
active focused or skipped unit tests and confirmed that Cycle 7's three
conditional CSV assertions were fixed. The findings below instead identify
specific green tests that fail to exercise the current contracts. They are
test-lens findings, not duplicate correctness/performance IDs.

## RPF8-TE-001 — the direction conformance matrix omits Korean compounds and conflicting neutral fields

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Test location:** `packages/parser/__tests__/conformance/cycle7-parser-direction.test.ts:32-128`
- **Shared behavior under test:** `packages/parser/src/shared/amount-fields.ts:40-79,81-126,128-173,221-282`
- **Stated matrix:** `.context/plans/102-cycle7-parser-direction-diagnostics.md:46-55`

The conformance file tests two English `Credit`/`Debit` orders, separate
Korean `환불금액` and `출금액` columns, and one English combined header
(`Debit/Credit`). It contains no Korean compound incoming/outgoing header and
no row with multiple populated neutral candidates. A repository-wide test
search found no `입출금액`, `입/출금액`, `입금/출금액`, or
`이용금액`/`청구금액` conflict case.

The omissions matter because executable mutations outside the suite showed:

- all three Korean compound forms classify as outgoing while the English form
  is ambiguous; and
- swapping two populated neutral headers changes parsed spending from 10,000
  to 9,000 won with no diagnostic.

All tests remain green because the matrix proves only the curated English
combined form and separate Korean columns, not the semantic property claimed
by the completed plan.

**Concrete false-green scenario:** a future or current export uses
`입출금액`, or publishes both original and billed amounts. The full parser
suite passes while server and browser silently admit a deposit or select a
different amount after a header reorder.

**TDD fix:** add table-driven shared-kernel tests first for Korean compound
markers, separator/spacing/full-width variants, and every permutation of two
populated neutral fields. Assert the classification, zero accepted rows on
ambiguity, exact diagnostic code/count, and identical-value collapse if that
is the chosen contract. Then run the same fixtures through server/browser
CSV, XLSX, HTML, JSON, and PDF-table consumers, with both header orders.

## RPF8-TE-002 — diagnostic-bound tests start after the expensive tabular allocation

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Worker tests:** `apps/web/__tests__/parser-worker.test.ts:263-327`
- **JSON source-bound test:** `packages/parser/__tests__/json-entrypoint-parity.test.ts:59-84`
- **Special-case required-field tests:** `packages/parser/__tests__/conformance/cycle6-parser-integrity.test.ts:36-121`
- **Uncovered production path:** `packages/parser/src/csv/generic.ts:255-356`;
  `apps/web/src/lib/parser/csv.ts:403-481`
- **Acceptance claim:** `.context/plans/102-cycle7-parser-direction-diagnostics.md:39-42,52-62`

The worker test constructs an already materialized array of 250
`ParseError`s, then proves serialization returns 100. It cannot detect memory
or CPU used while a parser built that input array. The source-level bound test
exercises JSON. HTML and OFX tests exercise only blank-merchant diagnostics,
which have their own `MAX_REQUIRED_FIELD_ROW_ERRORS` counters. No large
CSV/XLSX/HTML/OFX case drives non-spending, ambiguous-direction, invalid
amount, or nonblank invalid-date errors through the parser itself.

A 20,000-row ambiguous CSV returned exactly 20,000 errors from both server
and browser entry points while the full suite passed. This is the precise
false-green boundary: serialization is bounded, source construction is not.

**Concrete false-green scenario:** a patch preserves
`MAX_SERIALIZED_PARSE_ERRORS` while accidentally or currently materializing
hundreds of thousands of parser diagnostics and raw rows. Unit tests report a
bounded worker response even though the worker can stall or exhaust memory
before reaching the assertion's code.

**TDD fix:** create a shared large-input contract that invokes each real
parser entry point, not the serializer. For every row-diagnostic class and
format, mix rejected rows with at least one valid row and assert at most 99
examples plus one exact counted summary, valid-row preservation, error-code
counts, server/browser parity, and a bounded serialized result. Keep a 101-row
boundary test for fast unit feedback and a larger deterministic case for
allocation/size regression coverage.

## RPF8-TE-003 — the “exact rule-level and global” test never asserts the rule-level event

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Test location:** `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:276-300`
- **Related legacy test:** `packages/core/__tests__/calculator.test.ts:432-442`
- **Implementation:** `packages/core/src/calculator/reward.ts:539-571,879-887,946-955`
- **Result contract:** `packages/core/src/models/result.ts:1-27`

The Cycle 7 case named “keeps exact rule-level and global-cap state coherent”
sets both caps to 100, but it asserts only the category bucket and a
`monthly_total` entry. It never requires a `monthly_category` entry.
The older calculator test explicitly accepts a cap being represented “either
in `capsHit` or captured in `capReached`” and also avoids the collection
contract. There is no rule-only exact-exhaustion test.

The current calculator therefore passes every test while returning
`capReached: true` and `capsHit: []` for a 100-won exact rule-level cap with no
global cap. Terminal/report tests use fabricated `monthly_category` fixtures,
so they prove rendering only after the calculator has supplied an event.

**Concrete false-green scenario:** exact global-cap behavior stays correct,
so the named dual-cap test passes, while exact category-cap disclosure is
lost before terminal and HTML sinks. Users see no cap event despite the
category bucket being exhausted.

**TDD fix:** add a rule-only table before changing implementation: one below,
single exact, cumulative exact, clipped, and zero cap. Assert reward,
`CategoryReward.capReached`, and the complete `capsHit` array, including
`monthly_category` actual/applied values. Add dual exact rule/global cases
that require both event types, then feed calculator output—not fabricated
fixtures—through optimizer and cap-disclosure helpers.

## Verification and flakiness sweep

- `bun run test`: passed all workspace and script tests.
- `bun run lint`: passed all seven workspaces; Astro reported 0 errors,
  0 warnings, and 0 hints.
- `bun run typecheck`: passed all seven workspaces with the same clean Astro
  result.
- `bun run data:check`: passed all 683 authored cards, 24 issuers, generated
  catalogs/shards/fallback labels, and README parity.
- The skip/focus scan found no active `.skip`, `.only`, `.todo`, or `.fixme`
  unit tests. No newly introduced conditional no-op assertion was found.
- No browser or E2E run was performed, as required by the assignment.

## Final missed-issue sweep

The bounded final sweep revisited runner discovery/exclusions, timeout and
clock use, order/randomness, shared mutable state, process-spawn tests,
fixtures, exact-count assertions, server/browser parity, generated-data
checks, coverage seams, recent Cycle 7 regressions, and every historical test
finding. The remaining `>= 0` legacy smoke assertions were not relabeled
because they are unrelated to the current Cycle 7 changes and do not add a
higher-priority root cause beyond the three gaps above.

Final count: **3 Medium findings**, all confirmed with High confidence.
