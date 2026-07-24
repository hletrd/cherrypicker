# Review-plan-fix Cycle 20 — critic

## Review identity

- Date: 2026-07-24
- Reviewed revision: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: adversarial multi-perspective critique of the current complete product
- Product/source changes: none
- Browser, Playwright, Chrome, and deployment work: none

## Result

No genuinely new Cycle 20 root survived historical reconciliation.

One current Low-severity integrity defect was independently reproduced, but it
is a latent completion gap in the explicit archived Plan 109 persistence
coherence contract rather than a new root:

- **C20-B-001 / Plan 109 regression — Low / High confidence:** a truncated
  result may contain a month with positive spending and zero transactions.
  Coherence treats that bucket as absent for previous-month provenance while
  the restored dashboard includes its spending in the all-month total.

This item is actionable and should be repaired; it must not inflate
`NEW_FINDINGS` because Plan 109 already promises that every persisted monthly
count/spending derivation agrees with the snapshot that produced it.

## Complete inventory and method

The critic inventoried all **2,424 tracked paths**:

| Surface | Paths / evidence |
| --- | ---: |
| Active tree outside `.context` | 1,172 |
| Historical reviews and plans | 1,252 |
| Production/config source paths | 208 |
| Test and E2E support paths | 181 |
| Executable `*.test.*` / `*.spec.*` paths | 148 |
| Rule/public-data/docs/fixtures in the active tree | 764 |

The active inventory covered every production and corresponding test
directory:

1. `apps/web`: upload admission; browser parsers and workers; analysis,
   optimization, replacement/reset epochs; persistence; catalog publication
   readers; cards/dashboard/report UI; routes, styles, and public scripts.
2. `packages/core`: calendar context, performance basis, categorization,
   reward calculation, cap telemetry, constraints, and greedy optimization.
3. `packages/parser`: format detection, encoding, CSV/XLS/XLSX/PDF/JSON/OFX/
   HTML adapters, shared amount/date/diagnostic contracts, archive bounds, and
   remote PDF fallback.
4. `packages/rules` and generated data: schemas, rule semantics, availability,
   browser-safe loaders, optimizer projections, 683 authored YAML cards, and
   generated publication identities.
5. `packages/viz`, `tools/cli`, and `tools/scraper`: terminal/HTML sinks,
   command validation and consent, catalog loading, network policy, bounded
   fetching, extraction validation, and atomic writes.
6. `scripts`, manifests, configs, workflow, and E2E: generator identity,
   dependency ownership, README synchronization, bundle budgets, toolchain
   policy, owned E2E lifecycle/cleanup, runner inclusion, and CI gate order.
7. Root and issuer documentation plus the full tracked review/plan index.

Every active source/test path was content-scanned. High-risk functions and
their consumers were then read as cross-file flows. Claims in comments and
tests were checked against implementation rather than assumed. The closing
sweep searched malformed inputs, checked arithmetic, exception boundaries,
stale async commits, cancellation, cache identity, truncation, dynamic
imports, unsafe sinks, network/filesystem authority, runner-only behavior,
and current-versus-archived ownership.

## Confirmed current defect under historical ownership

### C20-B-001 — a zero-count monthly bucket can carry phantom spending

- Severity: **Low**
- Confidence: **High**
- Classification: **confirmed current correctness/integrity defect; Plan 109
  completion gap, not a genuinely new Cycle 20 root**
- Canonical producer invariant:
  `packages/core/src/analysis/context.ts:157-175,189-205`
- Truncated coherence:
  `apps/web/src/lib/analysis-result.ts:926-984`
- Persistence shape/admission:
  `apps/web/src/lib/persistence.ts:822-844,867-925`
- User-visible consumer:
  `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`
- Missing regressions:
  `apps/web/__tests__/analysis-result.test.ts:667-843` and
  `apps/web/__tests__/store-persistence.test.ts:620-720,1756-1769,2121-2142`
- Historical owner:
  `.context/plans/_archive/109-cycle8-analysis-coherence.md:7-35`

#### Why the state is impossible

`buildAnalysisContext()` creates a monthly bucket only while iterating a
validated transaction and increments `transactionCount` on that same path.
A real monthly bucket can have zero spending when all rows are non-positive,
but it cannot have zero transactions. Therefore this is valid:

```text
spending = 0, transactionCount > 0
```

and this is not:

```text
spending > 0, transactionCount = 0
```

#### Why validation accepts it

The truncated validator checks only `transactionCount < 0`, so zero passes.
It adds zero to `representedTransactionCount`, then decides whether the
previous statement month exists using:

```text
(months.get(month) ?? 0) > 0
```

Consequently one bucket can simultaneously:

1. advertise arbitrary positive prior-month spending;
2. contribute no represented transactions; and
3. be treated as absent, allowing a
   `missing-calendar-month` previous-spending basis for the same month.

The persistence shape gate has the same nonnegative rather than positive
count condition. Final coherence therefore returns true and
`deserializeAnalysis()` restores the payload.

#### Direct current-baseline reproduction

A current-version truncated payload used:

```text
monthlyBreakdown:
  2026-06: spending 777777, transactionCount 0
  2026-07: spending 10000, transactionCount 1
previousSpendingBasis:
  missing-calendar-month 2026-06, assumedAmount 0
_truncatedTxCount: 1
```

The current functions produced:

```text
isAnalysisResultCoherent(...) = true
deserializeAnalysis(...).data !== null
warningKind = "truncated"
```

The restored dashboard sums both bucket amounts, so its secondary all-month
spending is inflated by 777,777 won even though the restored total transaction
count remains one and the disclosure says June was missing.

#### Reachability and severity

Fresh analyzer/reoptimizer output cannot create the state, and the affected
path requires an intentionally truncated current-version snapshot that was
tampered with or produced by a prior/buggy same-version writer. There is no
evidence of an ordinary upload producing it. That bounds impact to Low. It is
still a real failure of the deserializer's fail-closed integrity boundary and
of the stored-derivation contract.

#### Suggested root fix

1. Require every `monthlyBreakdown` entry to have a positive safe-integer
   `transactionCount` in the pure coherence validator.
2. Apply the same positive-count shape rule in persistence admission.
3. Keep `spending === 0` valid when `transactionCount > 0`, because a month
   containing only refunds/zero-value rows remains representable.
4. Add pure-validator and deserializer regressions for the phantom prior
   bucket plus a zero-spending/positive-count control.

## Historical disposition

Archived Plan 109 explicitly required semantic validation of monthly
count/spending summaries, atomic rejection of contradictory truncated
snapshots, and agreement of every stored derived field with the snapshot that
produced it. C20-B-001 is therefore the same persistence-coherence root with
a missed relational edge, not a new class of defect.

Cycle 18 and 19 history was treated only as provenance:

- the branded `YearMonth` and low-year predecessor closure remains correct;
- lower-bound validation is now total/fail-closed, including lazy
  `user-total` handling and persistence exception conversion;
- legacy catalog projections participate in publication identity;
- `.mts` and `.cts` dependency ownership is enforced.

Older parser divergence, static-host header limitations, session-storage
scope, algorithmic performance, mixed-runner standardization, and other
explicitly deferred items were not reissued.

## Whole-product adversarial challenges

The following competing hypotheses were traced and rejected:

- Fresh full snapshots cannot carry the phantom bucket: transaction facts are
  re-collected and every monthly entry is matched against the exact month map.
- The Cycle 19 `0000-01` repair does not reopen an exception path:
  `user-total` avoids predecessor work, calendar-derived bases reject the
  underflow, and deserialization catches final coherence exceptions.
- Browser catalog readers still pin summary, optimizer, category, and detail
  shards to one source hash; generated-data verification reports no drift.
- Parser failures cannot silently become a valid optimization when every date
  is invalid or every file is empty; the analysis boundary fails with an
  actionable error.
- Old parse/optimization runs cannot commit after replacement/reset because
  operation epochs, owned abort controllers, and validated replacement are
  checked before state mutation.
- CLI remote fallback remains opt-in with consent, while scraper requests
  retain allowed-host, DNS/address, redirect, response-size, and atomic-write
  boundaries.
- The owned E2E wrapper retains exact repository/run-directory/PID/PGID/port
  attribution. This review did not start it, so it created no browser process
  requiring cleanup.

## Read-only evidence

| Check | Result |
| --- | --- |
| Focused analysis/persistence suites | 215 passed, 0 failed, 543 expectations |
| Web `astro check` | 126 files; 0 errors, warnings, or hints |
| Dependency ownership/peer/vendor check | passed |
| Generated data and README drift check | passed; 683 cards, 24 issuers, 551 executable |
| Direct C20-B-001 coherence/deserialization probe | reproduced acceptance |
| Protected Cycle 42 artifact digests | unchanged |

No source, test, plan, generated artifact, dependency, manifest, workflow,
browser state, external system, or deployment was changed by this role.

## Cross-agent-likely overlap

C20-B-001 should overlap strongly with the verifier and test-engineer reports,
and may also be found by code-reviewer, debugger, tracer, or architect. Those
reports should be deduplicated to the Plan 109 repair obligation. A
test-engineer regression gap is supporting evidence, not a second root.

## Final missed-issue sweep

The final sweep rechecked every active directory and the complete historical
index for zero/negative counts, unsafe sums, month ordering, truncation
provenance, calendar edges, duplicate identities, cap arithmetic, unsupported
facts, parser parity, async ownership, publication versions/hashes, source
extension admission, runner exclusions, skipped tests, temporary resource
cleanup, unsafe output, network redirects, filesystem replacement, and
documentation truth.

Disposition:

- Genuinely new Cycle 20 roots: **0**
- Confirmed historical repair obligations: **1** (C20-B-001 / Plan 109)
- Non-actionable preventive observations promoted: **0**
