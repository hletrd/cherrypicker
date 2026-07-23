# Review-plan-fix Cycle 8 — verifier

**Review baseline:** `3fd993d471a8676170031f20715f6a53c99e8a9f`

## Inventory and verification model

The locked snapshot contains 2,199 tracked paths: 151 web, 873 package, 59
tool, 19 script, 16 E2E, 1,062 context, and 19 root/config paths. The active
inventory includes 203 production code paths, 151 tracked test paths, 686
YAML files, 59 JSON files, and 1,090 Markdown files.

The verifier followed the user-visible flow from upload/CLI input through
format detection, every parser family, canonical transaction facts,
categorization, calculator/optimizer state, persistence, web/terminal/report
consumers, and catalog publication. Stated behavior was taken from current
types, completed Cycle 7 plans, tests, CLI/help and repository documentation;
high-volume card data was checked through schema/publication gates. Historical
reviews were searched for each candidate so fixed findings were not repeated.

All three findings below are current executable mismatches. The first two are
new cases in the shared Cycle 7 amount-field kernel. The third is the
rule-level counterpart that remained after exact global-cap disclosure was
fixed; it does not re-report the fixed global branch.

## RPF8-VER-001 — Korean compound incoming/outgoing headers are classified as withdrawals

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Primary location:** `packages/parser/src/shared/amount-fields.ts:40-79,128-173`
- **Resolution path:** `packages/parser/src/shared/amount-fields.ts:176-197,227-282`
- **Representative consumers:** `packages/parser/src/csv/generic.ts:239-243,268-323`;
  `apps/web/src/lib/parser/csv.ts:387-390,415-469`
- **Stated behavior:** `.context/plans/102-cycle7-parser-direction-diagnostics.md:20-38,46-51,57-62`
- **Incomplete regression:** `packages/parser/__tests__/conformance/cycle7-parser-direction.test.ts:95-118`

The shared classifier splits compound names, but bare Korean `입금` is not an
incoming alias while bare `출금` is an outgoing alias. The suffix matcher also
recognizes `출금액`. Consequently all of these headers are classified as
outgoing:

```text
입출금액     -> outgoing
입/출금액   -> outgoing
입금/출금액 -> outgoing
Debit/Credit -> ambiguous
```

An executable server/browser CSV probe used:

```csv
date,merchant,입출금액
2026-07-01,급여입금,50000
```

Both parsers returned one 50,000-won spending transaction and no error. The
completed direction plan explicitly requires a combined header that cannot
establish direction to fail closed, and says incoming/refund rows never reach
categorization or rewards.

**Concrete scenario:** a Korean bank-account export uses one `입출금액`
column and a separate type/description field. A salary deposit appears as a
positive value. CherryPicker silently treats it as card spending, inflates
the statement total and performance basis, and can recommend a card using
money that was never spent.

**Root-cause fix:** detect semantic incoming and outgoing markers before
single-direction suffix classification. At minimum, include the bare incoming
tokens used by compound Korean headers and return `ambiguous` whenever both
directions occur. If a modeled direction/type column can resolve the row, use
it explicitly; otherwise fail closed. Add server/browser parity cases for
`입출금액`, `입/출금액`, `입금/출금액`, reversed spellings, spacing/full-width
separators, and every CSV/XLSX/HTML/JSON/table consumer.

## RPF8-VER-002 — multiple populated neutral amount columns make spending depend on header order

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Primary location:** `packages/parser/src/shared/amount-fields.ts:81-126,221-225,227-282`
- **Representative consumers:** `packages/parser/src/csv/generic.ts:239-243,268-328`;
  `apps/web/src/lib/parser/csv.ts:387-390,415-474`
- **Missing contract tests:** `packages/parser/__tests__/conformance/cycle7-parser-direction.test.ts:32-128`

`이용금액`, `청구금액`, `승인금액`, `할인전금액`, `할인후금액`, and many other
semantically different fields are all classified as neutral. When more than
one neutral candidate is populated, `preferredOrFirst(neutral)` selects the
first header. Generic inputs do not provide a preferred name, and differing
values are neither compared nor diagnosed.

An executable permutation probe produced:

```text
date,merchant,이용금액,청구금액 + 10000,9000 -> amount 10000
date,merchant,청구금액,이용금액 + 9000,10000 -> amount 9000
```

Both parses returned zero diagnostics. The same logical row therefore changes
the optimization input solely because an export reordered its columns.

**Concrete scenario:** a statement contains original usage amount and the
actual billed amount after an issuer discount. Depending on column order,
CherryPicker silently optimizes against either 10,000 or 9,000 won. A bank
template update that reorders columns changes results without changing any
transaction fact.

**Root-cause fix:** define an explicit, documented semantic priority for
neutral fields only where the product can prove which value represents
spending. Otherwise, when multiple populated neutral candidates differ, emit
`ambiguous_amount_direction` (or a more specific ambiguous-amount code) and
fail closed; identical values may safely collapse. Test all header
permutations, identical versus conflicting values, configured preferred
columns, and server/browser CSV/XLSX/HTML parity.

## RPF8-VER-003 — exact rule-level monthly exhaustion is absent from `capsHit`

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Contract:** `packages/core/src/models/result.ts:1-27`
- **Strict-only rule cap:** `packages/core/src/calculator/reward.ts:539-571`
- **Contradictory bucket fallback:** `packages/core/src/calculator/reward.ts:879-887`
- **Telemetry emission:** `packages/core/src/calculator/reward.ts:946-955`
- **User-visible sinks:** `packages/viz/src/report/generator.ts:335-336,391`;
  `packages/viz/src/terminal/summary.ts:87-96`;
  `packages/viz/src/terminal/comparison.ts:65-76`
- **Incomplete Cycle 7 assertion:** `packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts:276-300`

The result contract describes `capsHit` as the caps that were reached.
The public percentage helper marks a positive exact rule cap as reached, and
the main calculator sets the category bucket's `capReached` flag on equality.
However, the internal `applyMonthlyCap()` returns `capReached` only for strict
clipping (`rawReward > remaining`), and the `monthly_category` event is
emitted only from that strict result.

An executable one-transaction probe used 10% of 1,000 won, a 100-won
rule-level monthly cap, and no global cap:

```json
{
  "reward": 100,
  "bucket": {
    "reward": 100,
    "capReached": true,
    "capAmount": 100
  },
  "capsHit": []
}
```

The category state says the cap is reached while the collection explicitly
used by terminal and HTML cap disclosures says no cap was reached.

**Concrete scenario:** a user's last purchase exactly exhausts a category's
monthly benefit cap. The calculation is numerically correct, but CLI and
generated report cap sections omit the event and the report's “한도 N건”
badge remains zero. The next purchase earns no further category benefit even
though those surfaces do not disclose why.

**Root-cause fix:** use one reached predicate for the public helper, internal
rule cap, category bucket, and `monthly_category` event: positive reward plus
new checked total equal to or greater than the cap. Represent equality with
`actualReward === appliedReward`; reserve loss wording for strict clipping.
Keep zero-cap behavior explicit. Add rule-only exact, cumulative exact,
one-below, clipped, zero-cap, and simultaneous rule/global cases through
calculator, optimizer, terminal, comparison, and HTML report sinks.

## Verification

- Executable server/browser probes confirmed the Korean compound-header
  misclassification and the neutral-column order dependency.
- An executable calculator probe confirmed the exact rule-level
  `capReached: true` / `capsHit: []` contradiction.
- `bun run test`: passed all workspace and script tests, demonstrating that
  the current suite does not detect these cases.
- `bun run lint`, `bun run typecheck`, and `bun run data:check`: all passed.
  The data gate validated 683 cards across 24 issuers and every generated
  catalog/documentation family.
- No browser or E2E run was performed, as required by the assignment.

## Final missed-issue sweep

The final bounded sweep rechecked every amount-direction role and parser
consumer, date/amount normalization, categorization authority, performance
basis, exact arithmetic, category/global/per-transaction cap interactions,
optimizer projection, persistence validation, web/CLI/report disclosures,
catalog schemas, current completed plans, and historical duplicate evidence.
No additional current verifier issue met the evidence threshold.

Final count: **3 Medium findings**, all confirmed with High confidence.
