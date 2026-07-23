# Review-plan-fix Cycle 13 — document specialist

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Aggregate verdict: **confirm 2 current-HEAD roots — 2 Medium**
- Documentation-lane novelty: **0 additional root IDs**. The cap finding is
  the same root as `C13-CT-001`, `C13-CR-001`, `RPF13-TE-001`, and
  `RPF13-VER-001`; `RPF13-PERF-001` remains a separate performance root.
- Scope: review and this report only; no product, test, generated artifact,
  plan, dependency, staging, commit, push, deployment, browser, E2E, or
  external-system mutation

## Inventory and authority model

I reset the documentation review at the revision above and inventoried all
**2,318 tracked paths**: **1,152** tracked `.context` paths and **1,166**
active product, data, test, documentation, configuration, workflow, and
vendor-integrity paths.

The tracked Markdown inventory contains **1,180 files**. Twenty-nine are
outside `.context`:

- the root `README.md`;
- `.claude/AGENTS.md` and `.claude/CLAUDE.md`;
- 24 generated issuer READMEs;
- `vendor/README.md`; and
- `.omc/plans/cycle14-fixes.md`.

The `.omc` plan is historical implementation provenance, not current user or
contributor guidance. Parser `__tmp_*/*.txt` files are fixtures, not
documentation. The license was reviewed separately. For large generated
families, I checked their authoritative generator, schema, current artifacts,
and drift gates rather than treating repeated output as independent prose.

The review treated the following as documentation contracts:

1. README and contributor instructions;
2. package scripts, root/subcommand help, errors, and scraper help;
3. public web, terminal, and standalone-report copy;
4. exported result types, schema comments, JSDoc, and implementation comments
   that promise scope or behavior;
5. YAML schemas, catalog validators, generated README templates, and
   publication ownership; and
6. workflow/toolchain, remote-LLM consent, scraper quarantine, and vendor
   integrity guidance.

I traced those claims through their executable parsers, core calculation and
optimization paths, worker/persistence boundaries, presentation sinks,
canonical card/category/issuer sources, generated public artifacts, and
tests. I also indexed the complete `.context` ledger by claim, path, and
historical owner, including every Cycle 13 report available before close.

The README's supported formats, 683/551/24 catalog counts, Astro 7/Svelte
5/Tailwind 4/TypeScript 5.9/Bun 1.3.12 versions, Bun-only commands,
`verify`/E2E distinction, remote-PDF consent, and scraper key/model/host/
output/quarantine sequence agree with current code. Both `.claude` guides'
paths and schema examples validate. All generated issuer READMEs agree with
the YAML catalog, and the vendor policy agrees with the archive/integrity
check.

## Confirmed aggregate root — event-local cap telemetry supports an unqualified result-level “no loss” claim

- **Aggregate aliases:** `C13-CT-001`, `C13-CR-001`, `RPF13-TE-001`,
  `RPF13-VER-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed as one cross-layer contract defect; merged, not
  assigned a new document-specialist ID
- **Public result contract:** `packages/core/src/models/result.ts:1-35`
- **Cap-exhaustion selection boundary:**
  `packages/core/src/calculator/reward.ts:314-388,451-559,807-845`
- **Event emission:** `packages/core/src/calculator/reward.ts:1025-1040`
- **Browser derivation and copy:**
  `apps/web/src/lib/cap-disclosures.ts:23-50`;
  `apps/web/src/components/ui/CapDisclosures.svelte:20-35`
- **Terminal/report contract:** `packages/viz/src/cap-disclosure.ts:16-29`;
  `packages/viz/src/terminal/summary.ts:86-96`;
  `packages/viz/src/report/generator.ts:415-435`
- **Historical contract source:** `.context/plans/136-cycle12-browser-cap-disclosure.md:7-40`

`CapInfo.actualReward` is documented as “What you would get without cap,” and
`appliedReward` as “What you actually get.” The exported type does not say
that both values belong only to the transaction that emitted the cap-reach
event. It carries no transaction identity, cap-blocked candidate, or
post-exhaustion total.

The implementation is internally coherent only under that narrower,
event-local reading. A positive candidate encountered after its rule/shared
or global cap is already exhausted becomes undifferentiated
`inapplicable` before reward execution. It emits no second `CapInfo` and
retains no potential reward. The earlier exact-reaching transaction remains
the sole event, with equal `actualReward` and `appliedReward`.

Every presentation layer then widens the meaning:

- the browser computes `lostReward` solely as
  `max(0, actualReward - appliedReward)`;
- its section asks users to inspect “한도 때문에 받지 못한 금액”; and
- browser, terminal, and standalone output turn zero into the affirmative
  statement `혜택 손실 없음`.

That conclusion is unsupported by an event-only DTO. If the intended contract
is event-local, the copy omits its scope. If it is analysis-wide, the producer
omits later cap-blocked reward. Either interpretation yields the same root
defect.

### Concrete current-card scenario

With `bc-baro-clear-plus`, 150,000 Won previous spending, and two 50,000-Won
Coupang purchases:

1. the first purchase earns 5,000 Won and exactly consumes its supported
   5,000-Won monthly cap;
2. the second purchase still matches a pre-cap 5,000-Won benefit but is
   rejected after exhaustion and remains unassigned;
3. the optimizer returns 100,000 Won total spending, 5,000 Won reward,
   50,000 Won unassigned spending, and one exact `capsHit` event whose values
   are 5,000/5,000; and
4. the browser derives zero and renders `혜택 손실 없음`.

The reward and assignment arithmetic remain correct. The defect is the
financial explanation: a concrete no-loss assertion can hide why a later
eligible purchase earned nothing. That keeps severity at Medium rather than
High.

### Plan 136 novelty adjudication

Plan 136 is the owner of the browser disclosure surface, not a prior owner of
this post-exhaustion defect. Its evidence showed a transaction clipped from
2,000 to 1,000 Won, and its outcome promised that all browser surfaces would
explain lost benefit “using the authoritative plural `capsHit` telemetry”
(`.context/plans/136-cycle12-browser-cap-disclosure.md:7-18`). Acceptance then
required applied reward and lost benefit to match that telemetry
(`:33-40`).

That contract is valid for the clipped event Plan 136 exercised. It did not
define event versus analysis scope and did not compose an exact hit with a
later eligible purchase. Commit
`c1126fd9c89efae2049cc4e2b56be025a56a4774` introduced the unqualified
browser no-loss conclusion. The current finding therefore exposes Plan 136's
previously untested assumption; it is not a duplicate of the old missing-sink
finding.

Plan 130 likewise fixed only false period wording for `per_transaction`
events while explicitly preserving existing lost-benefit disclosure
(`.context/plans/130-cycle12-standalone-cap-period-copy.md:7-34`). It did not
define post-exhaustion scope.

### Root fix and contract tests

First choose and document the promised quantity:

- For an **event-local** disclosure, rename/document the DTO accordingly,
  identify the reaching transaction or event, and replace the broad
  conclusion with scoped copy such as “한도 도달 거래에서 삭감 없음.”
- For an **analysis-level** disclosure, introduce typed core telemetry for a
  positive candidate suppressed solely by rule/shared/global cap state.
  Keep gross suppressed benefit separate from fallback/alternative reward and
  net portfolio loss so presentation code does not invent financial
  semantics or double count optimizer alternatives.

Worker transfer, persistence, coherence validation, terminal, browser, and
standalone-report schemas must preserve the chosen representation.
Regression coverage should compose real producers with every sink and cover
exact hit as the final match, exact then later match, clipping then later
matches, rule/shared/global/zero caps, additive and exclusive rules,
lower-priority and other-card fallback, and unassigned spending.

## Confirmed separate aggregate root — shared-cap coherence is rebuilt on every optimizer replay

- **Aggregate ID:** `RPF13-PERF-001`
- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed as a separate runtime root; it creates no additional
  public-documentation mismatch
- **Structural validation:** `packages/core/src/calculator/reward.ts:74-121`
- **Unconditional calculator entry:** `packages/core/src/calculator/reward.ts:742-752`
- **Replay paths:** `packages/core/src/optimizer/greedy.ts:195-230,295-309,
  359-390,405-445,603-624`
- **Existing authoring/publication validation:**
  `packages/rules/src/catalog-validation.ts:407-459`;
  `tools/cli/src/card-catalog.ts:31-80`
- **Historical contract source:** `.context/plans/129-cycle12-cap-identity-coherence.md:7-43`

The helper scans every supported rule/tier and creates outer and per-group
maps. `calculateRewards()` invokes it on every call. The greedy optimizer
replays the same immutable card definition before/after candidate scoring,
assignment construction, alternatives, card results, and best-single-card
comparison.

The same-cycle isolated benchmark removed only that repeated placement and
preserved byte-identical output. With the real artifact and 100 transactions,
current HEAD made 125,075 calculator calls and created 451,946 coherence maps:
267.6 ms median versus 221.8 ms, a 45.8 ms / 20.6% increase. At 1,000
transactions, identical 1,326,730-Won results differed by about 301.7 ms.
This supports Medium/High independently of a documentation promise about
latency.

### Plan 129 novelty adjudication

Plan 129 correctly owns shared-cap **correctness**. It requires validation for
tier/cap coherence, transaction-order invariance, stable rule/group identity,
and direct-core failure (`.context/plans/129-cycle12-cap-identity-coherence.md:
17-43`). Nothing in its outcome, implementation, acceptance, or completion
evidence defines a validation lifecycle, permits rebuilding maps per reward
replay, or budgets that frequency.

The performance defect is therefore new relative to Plan 129: the invariant
must remain, but its placement need not multiply with every calculator replay.
It is also distinct from the older deferred greedy-history/rescoring roots,
which predate `assertCoherentCapGroupMonthlyCaps()` and own the broader
incremental-optimizer redesign.

**Root fix:** retain fail-fast public `calculateRewards()` behavior and
prepare/validate each distinct card once at `greedyOptimize()` entry. Pass an
opaque, invocation-scoped immutable prepared representation to a private
calculator path. Do not use a bare process-global `WeakSet`, because callers
can mutate an object after validation. Tests should prove malformed direct
and optimizer inputs still fail, direct/prepared results are identical, and
structural validation runs at most once per distinct card per optimization
invocation.

## Historical reconciliation and rejected documentation candidates

- Cycle 7/Plan 104 and Cycle 8/Plan 110 correctly established exact-hit
  events and event-local equality. The present failure begins only when a
  later eligible purchase is combined with broad result-level copy.
- Cycle 11/Plan 127 added plural rule/cap-group identities; it did not define
  post-exhaustion loss.
- Cycle 10 `RPF10-PERF-001`/Plan 121 removed duplicate full-result coherence
  validation on the browser main thread. It is not the per-replay core rule
  scan found here.
- Cycle 6–12 documentation findings for Astro/toolchain commands, Bun
  development, PDF/scraper keys and help, CI wording, mileage valuation,
  source-link terminology, root `parse`, and scraper provenance are fixed and
  were not relabeled.
- `scripts/build-json.ts` still says “a single organized JSON file,” although
  the generator publishes multiple artifacts. Cycle 12 already recorded this
  as residue of an owned multi-artifact publication issue, so it receives no
  new ID.
- `.claude/AGENTS.md:102` says category IDs come from “the above list,” while
  the exhaustive source is the linked `categories.yaml` at `:68-73`. The
  nearby source-of-truth instruction is correct; the deictic wording is
  editorial polish, not a conflicting executable contract.
- `greedy.ts:232` and `:419` contain stale line-number references to positive
  transaction filtering now at `:501-507`. Their asserted invariant remains
  true and is defensively checked at `:213-219`; no behavioral finding is
  promoted from navigation drift.
- Current supported catalog data has no cap group shared across multiple
  supported rules. Text-identical same-category cap events and future
  cross-category `monthly_category` wording remain within prior Cycle 12
  identity/presentation scope, not new current-catalog roots.
- The prefixed/leading-NUL XLSX hypothesis is **explicitly rejected again**.
  Archive admission still requires `PK` at byte zero, and no current parser
  evidence establishes a bypass. It is not resurrected as a documentation,
  parser, or security finding.

## Verification and final missed-issue sweep

Read-only checks at the reviewed revision passed:

```text
bun run docs:check
Verified README catalog: 683 cards (551 optimizer-executable) across 24 issuers.

bun scripts/build-json.ts --check
683 YAML cards parsed; all generated catalog targets were current.

bun run toolchain:check
Toolchain check passed: Bun 1.3.12

bun run dependencies:check
Dependency manifests, imports, and vendored archives are valid.
```

Rendered root, `analyze`, `optimize`, `report`, root `scrape`, and direct
scraper help agreed with their shared option parsers, defaults, supported
issuer lists, credential rules, output behavior, and quarantine language.

The focused documentation/help/cap-contract matrix passed **92 tests, 1,195
expectations, 0 failures** across:

- README and workflow consistency;
- root and command-specific CLI help;
- scraper arguments and runtime configuration;
- browser and visualization cap disclosure; and
- exact cap state and shared cap-identity coherence.

Those green tests are also negative evidence for the confirmed cap finding:
the core suite covers exact exhaustion followed by another purchase, while
presentation suites separately map an equal exact event to “no loss”; no test
composes those layers into the failing user scenario.

The final sweep rechecked all same-cycle reports, Plans 129/130/136, complete
historical keyword ownership, current help output, user-facing cap copy,
schema/JSDoc scope, generated-document ownership, toolchain/workflow claims,
and the candidate exclusions above. No third root or additional
documentation-only ID met the evidence threshold.

The six protected Cycle 42 artifacts retained their pre-review SHA-256
digests. No source, test, plan, generated artifact, dependency, browser, E2E,
staging, commit, push, deployment, or external system was changed.

**Final aggregate count: 2 current-HEAD roots — 2 Medium. Documentation-lane
additions: 0 duplicate or standalone IDs.**
