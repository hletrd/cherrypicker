# Review-plan-fix Cycle 14 — architect

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: package and module layering, lifecycle and invariant ownership,
  dependency direction, domain/worker/persistence contracts, generated-data
  authority, coupling, and cross-system failure containment
- Disposition: **1 genuinely new finding confirmed — 1 Medium; 0 additional
  architect-only findings**
- Scope: review and this report only; no product source, test, plan,
  configuration, dependency, generated artifact, staging, commit, push,
  browser, E2E, deployment, or external-system mutation

## Locked inventory and architecture map

The exact Git tree contains **2,337 tracked paths**: **1,169** tracked
`.context` paths and **1,168** active product, data, test, documentation,
workflow, configuration, and vendor-integrity paths. The active tree consists
of 880 package paths, 171 application paths, 63 tool paths, 19 scripts, 16 E2E
paths, and 19 root/workflow/configuration/vendor paths.

The implementation-oriented inventory includes 202 non-test runtime
TypeScript/JavaScript/Svelte/Astro/CSS paths, 148 unit/E2E test paths, 23
configuration/manifest/workflow paths, 29 active Markdown paths, all 683
authored card YAML files and 24 issuer documents, and 30 generated/public JSON
paths. The declarative card graph was reviewed through its complete schema,
semantic validator, publication projections, common source identity, and
runtime readers rather than by sampling individual cards.

The production workspace graph remains one-way:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

No production package imports an application. The package export maps,
production imports, peer contracts, and vendored archive identities pass the
repository dependency gate.

The architecture trace covered:

1. browser file admission -> parser queue/workers -> shared format kernels ->
   canonical transaction facts -> categorization and calendar/performance
   context;
2. card/category YAML -> schema and semantic validation -> deterministic
   summary/detail/optimizer projections -> browser and CLI readers;
3. prepared reward rules -> actual and cap-free calculation -> greedy
   assignment -> optimizer loss telemetry;
4. worker clone decode -> framework-free analysis coherence -> replacement
   epochs -> persistence/migration -> Svelte, terminal, and standalone-report
   consumers;
5. scraper network policy -> untrusted model extraction -> deterministic
   provenance/quarantine -> guarded rule writer; and
6. manifests/lockfile -> dependency, data, build, E2E-process, and static
   deployment gates.

For duplicate control I indexed all current and archived review/plan records,
the deferred register, the Cycle 10–13 aggregates and architect reports,
Plans 72 and 138–140, the existing Cycle 14 specialist reports, and the six
protected untracked Cycle 42 artifacts. Historical debt, repaired contracts,
and rejected hypotheses were not relabeled as new.

## Finding

### RPF14-PERF-001 — optimizer append scoring replays a cap-free history whose stateless prefix was already reconciled

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by source/lifecycle tracing, an independent unsafe-prefix
  probe, operation counts, exact-output comparisons, and independent same-cycle
  differential evidence
- **Manual validation:** Not required
- **Exact locations:**
  - `packages/core/src/calculator/reward.ts:128-190` creates the branded
    invocation-local prepared rule and already derives
    `hasStatefulReward`.
  - `packages/core/src/calculator/reward.ts:677-935` builds actual and
    counterfactual candidates, group maps, copied state, ordered projections,
    and stateful reservations.
  - `packages/core/src/calculator/reward.ts:1127-1179` exposes the internal
    prepared replay boundary; `capSuppressionStartIndex` is only an emission
    boundary.
  - `packages/core/src/calculator/reward.ts:1202-1230` allocates
    counterfactual state and computes `emitCapSuppression`, but leaves
    collection enabled for every older row.
  - `packages/core/src/calculator/reward.ts:1528-1628` therefore reconciles
    counterfactual reservations and completeness for non-emitting historical
    rows.
  - `packages/core/src/optimizer/greedy.ts:208-264` appends one transaction,
    enables suppression collection for capped cards, and passes the old
    history length as the start index.
  - `packages/core/src/optimizer/greedy.ts:630-675` owns the monotonic
    `portfolioCapLossesComplete` lifecycle proof.
  - `packages/core/package.json:7-13` and
    `packages/core/src/index.ts:53-71` keep prepared calculation outside the
    public package surface.
  - `packages/core/__tests__/cycle13-prepared-cap-validation.test.ts:232-270`
    verifies emitted-result parity but not counterfactual operation count or
    an unproved-prefix fallback.

#### Failure scenario

A 1,000-row latest-month statement is scored against the current compiled
optimizer artifact. Of 682 artifact cards, 551 are optimizer-executable, 383
executable cards have a cap, and only two executable cards have supported
`maxUses`/fixed-per-day state.

For each new transaction and capped candidate, the optimizer calculates the
candidate's assigned history plus the appended row. Older rows cannot emit
because they are before `capSuppressionStartIndex`, but
`collectCapSuppressions` remains true. The calculator consequently rebuilds
the cap-free selection and reconciliation for the entire history of the 381
capped-but-stateless cards.

The actual history replay remains required to reconstruct monthly and global
cap consumption. The appended-row counterfactual also remains required for
truthful loss telemetry. Only the older stateless counterfactual body is
redundant.

Exact-HEAD instrumentation counted 340,779 avoidable old-row counterfactual
replays at 1,000 transactions, including 340,779 group maps, 681,558 copied
map/set state objects, and 340,779 projections. Five alternating real-artifact
samples retained exact complete optimizer JSON while saving 216.3 ms / 5.6%
at 1,000 rows. A separate critic comparison measured 291.1 ms / 8.2% with
exact output and 10,000 randomized optimizer cases matched exactly. Browser
execution stays off the main thread, but results arrive later and consume more
CPU/battery; CLI optimization/reporting pays the work synchronously.

#### Independent proof-boundary adjudication

The optimizer, not the calculator, owns the fact that a prefix was previously
reconciled:

1. every transaction later present in a card's assigned prefix was scored for
   that card as the appended/current row in an earlier greedy iteration;
2. while telemetry is enabled, that current-row score performs the full
   counterfactual check;
3. any incomplete score latches
   `portfolioCapLossesComplete` from true to false; and
4. once false, later scoring disables telemetry and cannot reuse a purported
   completeness proof.

The calculator owns the orthogonal fact that a prepared card is stateless.
For `maxUses` and fixed-per-day rewards, an old cap-free choice can reserve an
occurrence/day needed by the appended row, so complete historical
counterfactual replay must remain.

Neither fact is sufficient alone. In particular,
`capSuppressionStartIndex` does not prove that the prefix was ever checked. I
independently ran a direct prepared-call probe with a stateless,
higher-priority capped 1% rule, a lower-priority uncapped 5% fallback, and an
unrelated later row. With `capSuppressionStartIndex: 1`, current HEAD returned:

```json
{
  "totalReward": 500,
  "capSuppressions": [],
  "capSuppressionsComplete": false
}
```

The older row's cap-free choice is weaker than its actual fallback, so the
prefix is incomplete even though it emits no row. An unconditional
“stateless row before start” skip would incorrectly manufacture
`capSuppressionsComplete: true`. Direct and ordinary prepared calls must
therefore retain full replay by default.

#### Architecture decision: smallest coherent seam, not a public capability

The refined fix is architecturally sound and does not require an incremental
optimizer, cache, persistent watermark, or new public calculator API.

The existing internal optimizer-to-calculator seam is the correct placement:

- the optimizer asserts only that its current prefix was previously
  reconciled;
- the calculator derives statefulness from the branded prepared value and
  enforces row scope itself;
- public `calculateRewards()` and ordinary
  `calculateRewardsWithPreparedCard()` calls remain fail-closed; and
- the package export map continues to hide the prepared replay API from
  consumers.

A bare boolean should not be described as an unforgeable proof. It is an
internal lifecycle claim whose safety comes from a safe default, one
production authority/call site, and independent callee checks. To avoid
creating freely composable modes, prefer an internal discriminated replay
policy such as:

```text
full counterfactual replay
optimizer-reconciled prefix, emit from N
```

The latter may carry the requested
`prefixCounterfactualAlreadyReconciled` assertion, but it must remain absent by
default and tied to the start index as one policy. A branded token factory
would not add real safety because only the optimizer's live monotonic state
can establish the assertion; a persisted per-card watermark would add
state/invalidation complexity disproportionate to this repair.

This is the smallest coherent architecture if all of the following remain
true:

1. only `scoreCardsForTransaction()` selects the optimized replay policy, and
   only while its `collectPortfolioTelemetry` /
   `portfolioCapLossesComplete` input is true;
2. the calculator treats the optimizer claim as necessary but not sufficient:
   it also requires `preparedCardRule.hasStatefulReward === false`,
   counterfactual collection enabled, and
   `transactionIndex < capSuppressionStartIndex`;
3. actual selection/execution still runs for every row;
4. stateful cards, current/emittable rows, unproved prepared calls, and public
   calls retain the complete current path; and
5. neither the policy nor a new unchecked function is added to the public
   barrel/export map.

With those constraints, the option does not leak a dangerous public
capability. Without them—especially if the start index alone enables the fast
path—it is a correctness regression.

#### Suggested fix and regressions

1. Replace the current independent emission-only start-index plumbing with a
   private replay policy, defaulting to full. If the minimal implementation
   uses `prefixCounterfactualAlreadyReconciled?: boolean`, default it to false
   and keep it paired with `capSuppressionStartIndex` inside the internal
   option object.
2. Have only the scoring call at
   `packages/core/src/optimizer/greedy.ts:257-264` opt in, gated by the
   monotonic completeness input at lines 662-675.
3. Pass prepared statefulness into the private kernel. Derive one per-row
   `collectTransactionCounterfactual` value and use it consistently in
   candidate collection, counterfactual state allocation/projection, and the
   reconciliation block.
4. Preserve the actual calculation, current-row telemetry, all stateful
   history, and every safe-integer/unsupported-rule guard.
5. Add internal observer regressions proving:
   - zero pre-start counterfactual projections for a proven stateless
     optimizer prefix;
   - unchanged historical projections for `maxUses` and fixed-per-day cards;
   - full replay for ordinary prepared calls with a nonzero start index;
   - the unsafe direct fixture above remains incomplete; and
   - the optimized mode has exactly one production call site and stays absent
     from the public package surface.
6. Retain exact whole-result parity on the compiled artifact and randomized
   cap/stateful optimizer fixtures.

#### Novelty and overlap control

This is not deferred `D-C1-040`, `D-09`, `D-C10-02`, or `C20-PERF01`. Those
entries own the older actual-history replay and an eventual incremental
optimizer. This repair leaves that algorithm and multiplier intact and removes
only the second cap-free body introduced by telemetry commit `d7ffac3`.

It is also not Cycle 13 `RPF13-PERF-001` / Plan 139. That finding concerned
repeated immutable rule-structure validation before every calculation. Current
HEAD prepares each optimizer card once; this finding starts later inside the
prepared calculation.

Plan 138 correctly requires deterministic historical replay for
`maxUses`/fixed-per-day state. It does not require a stateless prefix that the
optimizer already reconciled to be projected again. Full-history searches for
the start index, stateless history, append-only telemetry, and cap-free replay
found no prior owner for this narrower regression.

## Whole-repository architecture sweep

No second genuinely new architecture root survived reproduction and
historical reconciliation.

- Browser `File`, queue, worker, abort, listener, settlement, and termination
  ownership remains in the application adapter; pure byte/row interpretation
  remains in browser-safe parser exports.
- Framework-free `AnalysisResult` and exhaustive coherence stay outside the
  Svelte store. Replacement epochs own externally visible commits; persistence
  independently owns migration, projection, decoding, truncation provenance,
  and storage failure.
- Summary, detail, category, and optimizer artifacts share one deterministic
  publication identity. Independently cached browser requests reject mixed
  generations before use.
- Rules owns schema, semantic support, catalog availability, executable
  capability, and publication validation. Core owns categorization,
  calculation, and optimization semantics.
- The optimizer worker output is decoded as an untrusted clone before
  application state; telemetry is then checked again against analysis-wide
  financial identities.
- CLI composition does not move parsing, rule, optimizer, or visualization
  ownership into commands. Report and scraper writers retain trusted-directory
  capabilities through atomic commit.
- Scraper target/network authority, untrusted model extraction, deterministic
  provenance stamping, support quarantine, canonical validation, and file
  publication remain separate fail-closed stages.
- Workflow privilege and static Pages publication remain downstream of
  read-only verification, with no production package/application dependency
  inversion.

## Historical and rejected candidates

- Parser/application implementation duplication and its remaining parity
  harness are longstanding `D-01` architecture debt. Browser-safe shared
  kernels have reduced it, but no new divergent behavior was reproduced.
- The broader incremental optimizer and compiled merchant matcher remain
  `D-C1-040` and `D-C1-041`; neither was relabeled.
- Handwritten worker/persistence decoders, catalog generator/browser-reader
  duplication, taxonomy fallbacks, navigation state, replacement/persistence
  state machines, and prior CLI custom taxonomy/catalog pairing all have
  fixed, rejected, or deferred provenance.
- Conservative `portfolioCapLosses: undefined` for non-additive stateful or
  negative-offset cases is Plan 138's intentional fail-closed contract, not
  missing ownership.
- The Cycle 42 amount and non-finite persistence reports are stale at current
  HEAD. The `safeJSONParse` key-list claim lacks a prototype-writing sink and
  was not promoted. The pre-existing CSP exception remains documented
  defense-in-depth debt rather than a Cycle 14 architecture regression.
- The prefixed/leading-NUL XLSX inflation hypothesis remains explicitly
  rejected. `packages/parser/src/shared/xlsx-archive.ts:118-130` inspects ZIP
  metadata only when bytes zero and one are `PK`; prefixed input stays on the
  non-ZIP/plaintext route. No new evidence contradicts the corrected
  reproduction.

## Verification and final missed-file sweep

- `bun run dependencies:check` passed: manifests, production imports, peer
  contracts, remote references, and vendored archive identities are valid.
- The focused exact-HEAD core run passed **80 tests, 288 expectations, 0
  failures** across cap-loss telemetry, prepared validation, optimizer, and
  merchant-boundary performance.
- The optimizer-only comparison passed **39 focused tests, 159 expectations,
  0 failures** and retained exact full optimizer JSON at 100, 500, and 1,000
  rows.
- The independent direct unsafe-prefix probe above reproduced incomplete
  current behavior, confirming why an unproved stateless skip is invalid.
- No server, browser, preview, E2E, deployment, production write, or external
  mutation was performed.

The closing sweep rechecked every active public export, cross-package import,
relative production dependency, mutable/global cache, worker and listener
owner, abort/timer path, storage/migration boundary, generated artifact,
runtime decoder, domain invariant, parser format/encoding/archive path,
catalog and documentation generator, CLI/scraper I/O boundary, workflow,
manifest, lockfile, and all 55 paths changed since the Cycle 13 review
baseline. Every remaining candidate was behaviorally contained, historically
owned, or lacked a concrete current failure.

The six protected Cycle 42 artifacts remain byte-identical. Concurrent Cycle
14 sibling reports were not modified. The only repository path written by
this role is `.context/reviews/cycle14-architect.md`.

**Final count: 1 new finding — 1 Medium (High confidence, Confirmed); 0
additional architect-only findings.**
