# Review-plan-fix Cycle 19 — critic

## Review identity

- Date: 2026-07-24
- Reviewed revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: adversarial, multi-perspective critique of the complete product and
  Cycle 18 repair surface
- Disposition: **one genuinely new Low-severity critic finding**
- Browser work: none assigned or performed
- Product/source changes: none

The review challenged correctness claims rather than accepting tests,
comments, plans, or the Cycle 18 aggregate as proof. Cycle 18 history is used
only to decide novelty after the current implementation was independently
read.

## Inventory and method

All 2,409 tracked paths were inventoried: 362 source/test paths, 739
rule/public-data paths, 1,237 context records, and 71 remaining manifests,
configs, docs, workflow, fixtures, and assets. The critic pass then traced the
highest-risk interactions across:

1. statement admission, browser/server parsing, worker boundaries, analysis,
   optimization, disclosures, persistence, and reoptimization;
2. YAML/schema/category truth, generator projections, publication identity,
   split browser readers, CLI compiled-catalog loading, and documentation;
3. workspace dependency declarations, lock/peer/vendor integrity, source
   discovery, import parsing, and CI gates;
4. UI state ownership, cancellation/navigation, generated report/terminal
   sinks, scraper network/write boundaries, and deploy authority.

Every production directory, corresponding test directory, entrypoint, package
manifest, and relevant generated artifact was examined. The complete
historical plan/review index was searched before assigning novelty.

## Adversarial challenge of Cycle 18

### `YearMonth` type/runtime agreement

The repaired boundary at `packages/core/src/analysis/context.ts:3-114` is
coherent:

- raw strings require `isYearMonth()` or `parseYearMonth()`;
- `yearMonthOfDate()` constructs through that boundary;
- same-year predecessors preserve the original four-digit year;
- January rollover pads the decremented year; and
- `0000-01` produces the documented range error instead of an asserted invalid
  value.

The brand is erased in JSON, and persistence initially re-establishes it
through `isYearMonth()` at
`apps/web/src/lib/persistence.ts:677-708,822-844`. That predicate also admits
the intentional lower-bound value `0000-01`; downstream coherence still
assumes predecessor construction is total. This exception interaction is the
new finding below. The ordinary product parser policy remains narrower than
the shared helper domain by explicit Plan 148 decision.

A synthetic December-0999/January-1000 context now selects the exact
predecessor (`packages/core/__tests__/analysis.test.ts:126-148`), and malformed
literal/type behavior is covered in
`apps/web/__tests__/analysis-context.test.ts:31-65`. No unchecked
`as YearMonth` construction remains in production.

## Finding

### C19-CT-001 — the explicit lower-bound error breaks validator totality

- Severity: Low
- Confidence: High
- Status: confirmed by source trace and direct runtime reproduction
- Domain throw: `packages/core/src/analysis/context.ts:96-109`
- Truncated coherence:
  `apps/web/src/lib/analysis-result.ts:893-981,988-1038`
- Persistence admission:
  `apps/web/src/lib/persistence.ts:677-708,720-742,822-915`
- Store recovery and misclassification:
  `apps/web/src/lib/store.svelte.ts:117-148`

Cycle 18 correctly made
`previousCalendarMonth(parseYearMonth('0000-01'))` throw because the
four-digit calendar domain has no predecessor. Boolean coherence and
deserialization boundaries, however, promise fail-closed classification and
still invoke that partial helper without converting the domain exception.

A current-version truncated snapshot can be structurally valid with no
`transactions`, `_truncatedTxCount: 1`, one positive category/month witness,
and `monthlyBreakdown[0].month = '0000-01'`. Both the basis parser and monthly
parser accept that valid `YearMonth`. `hasCoherentTruncatedFacts()` then calls
`previousCalendarMonth(latest.month)` at
`apps/web/src/lib/analysis-result.ts:964` and throws before returning `false`.
`deserializeAnalysis()` invokes coherence at
`apps/web/src/lib/persistence.ts:905-915` outside its JSON/migration catches,
so it throws too.

Direct reproduction produced:

```text
coherence THREW RangeError YearMonth 0000-01 has no representable previous month
deserialize THREW RangeError YearMonth 0000-01 has no representable previous month
```

The production store's outer catch removes the payload and prevents a route
crash, but labels this deterministic validation failure as a storage-access
error. Direct users of the exported validator/deserializer receive the
exception. Genuine parsers restrict statement years to 1900–2100, limiting
reachability to constructed, tampered, or stale persisted data and bounding
severity to Low.

The root fix should keep the direct predecessor `RangeError`, make coherence
return `false` when the latest month has no representable predecessor, and
defensively convert any validation exception in `deserializeAnalysis()` to
`invalidResult()`. Regressions should cover the boolean validator, the
deserializer's corrupted result, and the unchanged direct-helper throw.

This interaction is novel: Plan 148 owns the helper's deliberate underflow,
but no earlier plan, review, deferral, or rejection owns that new exception
crossing the older truncated-validation boundary.

### Catalog identity and versioning

The previous circularity risk is absent. `scripts/build-json.ts:298-395`
constructs identity-free legacy full, legacy compact, and browser projections;
`scripts/catalog-publication.ts:96-136` canonicalizes stable keyed values;
only then does `injectPublicationIdentity()` add the digest.

Legacy artifacts advertise schema `2.0.0`, browser summary remains `1.0.0`,
and all generated projections carry the same complete digest
`125970f582c040a0c6aa728cab49dea1173c1e7fbd96fc297876c5197291c200`.
The difference in schema version is intentional because version describes a
projection contract while the digest identifies one publication generation.
Mutation tests at `scripts/__tests__/catalog-publication.test.ts:652-720`
prove that either legacy projection changes the identity; artifact parity is
checked at `:722-786`.

Key-order canonicalization means semantically identical object order does not
manufacture a new identity. Runtime readers consume structured JSON rather
than source formatting, so this does not violate the actual cache/generation
contract.

### `.mts` / `.cts` dependency ownership

`scripts/check-dependencies.ts:11-22,465-511` now admits both extensions in
production/test recursion and derives config filenames from the same
extension inventory. `collectModuleSpecifiers()` at `:532-603` parses them as
TypeScript; ownership classification and diagnostics at `:605-692` remain
unchanged. Tests at
`scripts/__tests__/check-dependencies.test.ts:237-296` cover undeclared and
owned imports across production, test, and config files for both extensions.

No tracked module-TypeScript file currently exists, so this is preventive
coverage with no current runtime behavioral change. I found no alternate
discovery path that silently bypasses the new extensions.

## Whole-product critique

The following hypotheses were independently challenged and rejected:

- **Fresh versus restored analysis drift outside C19-CT-001:** ordinary
  analysis construction, storage shape validation, and derived coherence agree
  on months, totals, transaction counts, selected-card scope, cap-loss
  identities, and previous-spending provenance.
- **Mixed catalog generations:** summary, optimizer, category, and detail
  readers pin the same hash and abort/reset their owned request state; the
  legacy file remains outside the first-party request path.
- **Unsupported or discontinued recommendation:** generation excludes
  discontinued rules from the optimizer artifact, and the core optimizer
  further requires an executable supported reward before scoring. Catalog-only
  cards remain visible by design.
- **Parser failure becoming a partial recommendation:** empty/wholly rejected
  inputs fail closed; invalid-date rows are quarantined; only the latest valid
  month enters optimization; the exact previous month is retained solely for
  performance-tier basis.
- **State replacement race:** operation epochs, owned abort controllers, parse
  queue cancellation, and atomic validated result replacement prevent an old
  run from committing after a newer run or reset.
- **New package-layer inversion:** core still depends only on the browser-safe
  rules contract; parser has neutral browser exports; viz depends inward on
  core/rules; CLI and web remain composition layers; Node-only generator and
  scraper code did not enter browser packages.

## Historical reconciliation

Confirmed limitations such as web/server parser duplication, greedy replay
complexity, matcher scale, static-host CSP constraints, session storage,
full-page navigation, catalog compatibility payloads, and broad orchestration
files retain explicit historical owners or deferrals. No current change
altered their reachability or severity.

Stale canonical reports and old plans were treated as provenance, not as
current truth. In particular, pre-repair annual-fee/availability,
unsupported-card, parser-direction, persistence, report-sink, and catalog-hash
claims were checked against current source and were not reissued.

## Classification

- Confirmed genuinely new issues: one Low / High-confidence exception-closure
  defect, C19-CT-001.
- Likely genuinely new issues: none.
- Risks requiring manual validation: none promoted. A fresh browser session was
  outside this role; the separate designer owns live UI evidence.

## Read-only evidence

Dependency ownership, workspace type checking, all workspace/script unit
tests, and the full Vitest matrix passed. The bundle/request budget checker
also passed. No deployment, E2E run, browser, source edit, plan edit, generated
data write, or external mutation was performed.

## Final missed-issue sweep

The closing pass rechecked empty and malformed inputs, lower/upper calendar
boundaries, duplicate identities, unsafe numeric totals, cap ordering,
unsupported facts, mixed publication versions, cache and cancellation
ownership, source-extension classification, dynamic imports, error fallback,
serialization/deserialization, report/terminal escaping, network and
filesystem boundaries, and documentation claims.

No relevant file was skipped. C19-CT-001 is the only new root that survived
source evidence, concrete-failure analysis, and historical deduplication.

Final new finding count: **1**.
