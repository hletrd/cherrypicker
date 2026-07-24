# Review-plan-fix Cycle 19 — tracer

## Review identity and conclusion

- Date: 2026-07-24
- Reviewed revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: causal tracing, competing hypotheses, state-transition and
  cross-boundary failure analysis
- Disposition: **one genuinely new Low-severity tracer finding**
- Browser work: none assigned or performed
- Product/source changes: none

Cycle 18 repairs were retraced from source inputs to final consumers. A
candidate was counted only if a current causal chain produced a concrete
failure and did not already have a historical owner.

## Complete inventory

The trace began from all 2,409 tracked files: 362 executable/test source paths,
739 rule/public data paths, 1,237 plan/review provenance paths, and 71
manifests/config/docs/workflow/fixture assets. It explicitly followed every
entrypoint in:

- five Astro routes, the shared layout, 15 Svelte components, web stores,
  workers, loaders, and public scripts;
- core analysis, matcher, reward calculator, optimizer, numeric boundaries,
  models, and exports;
- browser and Bun parser dispatch for every supported format;
- rule validation/loading/publication, visualization, CLI, scraper, scripts,
  test runners, E2E ownership, and CI.

Generated data was checked as a connected artifact set rather than sampled:
683 YAML cards, issuer/category sources, two rule legacy files, three public
top-level catalog payloads plus categories, and all 24 issuer detail shards.

## Trace A — statement month to previous-spending basis

1. Browser workers return parsed rows through
   `apps/web/src/lib/parser/worker-protocol.ts`; Bun parsing reaches the same
   domain shape through `packages/parser/src/statement.ts`.
2. Web categorization and multi-file merge occur at
   `apps/web/src/lib/analyzer.ts:343-405`; CLI categorization occurs at
   `tools/cli/src/analysis.ts:31-56`.
3. `buildAnalysisContext()` validates each date and retains the refined month
   with its original transaction at
   `packages/core/src/analysis/context.ts:124-175`.
4. `previousCalendarMonth()` at `:96-114` produces an admitted four-digit
   value or the explicit lower-bound error.
5. Exact predecessor rows select `statement-month`; absence selects a
   disclosed zero assumption at `:178-187`.
6. `resolveCardPreviousSpending()` applies per-card exclusions at
   `packages/core/src/analysis/performance.ts:68-129`.
7. Web optimization receives only the latest month while retaining the exact
   predecessor at `apps/web/src/lib/analyzer.ts:407-454`; CLI uses the same
   core context at `tools/cli/src/analysis.ts:58-82`.
8. Persistence and result coherence independently validate the branded
   string's runtime form before accepting it.

Competing hypotheses checked:

- **Leading-zero loss remains:** rejected; same-year code preserves
  `yearText`, and rollover pads the decremented year.
- **The brand bypasses initial storage shape validation:** rejected; JSON
  erases the brand, but `isYearMonth()` re-narrows every stored month.
- **Fresh and restored results disagree:** rejected for every representable
  predecessor. The non-representable lower bound exposes the validator
  exception in C19-TR-001 below.
- **Year `0000` silently wraps:** rejected; `0000-01` throws a deliberate
  `RangeError`.
- **The parser domain was unintentionally widened:** rejected; Plan 148
  explicitly keeps parser policy narrower, and parser source is unchanged.

One causal failure survives at the interaction between the deliberate
lower-bound exception and the older fail-closed validation boundary.

## C19-TR-001 — `0000-01` escapes truncated coherence and deserialization

- Severity: Low
- Confidence: High
- Status: confirmed by source trace and direct runtime probes
- Throw source: `packages/core/src/analysis/context.ts:96-109`
- Boolean-coherence path:
  `apps/web/src/lib/analysis-result.ts:922-981,988-1038`
- Persistence path:
  `apps/web/src/lib/persistence.ts:677-708,720-742,822-915`
- Production outer recovery:
  `apps/web/src/lib/store.svelte.ts:117-148`

Causal sequence:

```text
current v4 truncated JSON
  → monthlyBreakdown month "0000-01" passes isYearMonth()
  → previous-spending basis month "0000-01" passes isYearMonth()
  → no transactions + positive _truncatedTxCount selects truncated coherence
  → latest month remains "0000-01"
  → previousCalendarMonth("0000-01")
  → RangeError escapes isAnalysisResultCoherent()
  → RangeError escapes deserializeAnalysis()
```

A minimal witness with one unit of category, month, unassigned optimizer
spending, and `_truncatedTxCount: 1` reproduced the same exact exception from
both exported entrypoints. The direct predecessor exception is intentional;
the defect is that boolean/data-admission validators fail to translate it into
their documented invalid result.

The store catches the exception one layer later and removes the snapshot, so
ordinary page startup does not crash. It reports a storage-access failure
rather than corrupted data, and direct callers still throw. Supported
statement parsers cannot emit this year, limiting the defect to constructed,
tampered, or stale state.

Keep the direct helper contract. Make coherence return `false` at the
non-representable predecessor, wrap final persistence coherence defensively,
and add lower-bound truncated regressions.

Plan 148 owns the underflow policy but not its propagation into the existing
truncated validator; tracked history contains no earlier owner for this
interaction. It is therefore a genuine Cycle 19 root.

## Trace B — YAML change to publication identity and browser cache

1. Rule YAML and issuer/category sources are schema-validated in
   `scripts/build-json.ts:112-184`.
2. Stable issuer/card/index projections are constructed at `:186-369`.
3. Identity-free legacy full, legacy compact, summary, optimizer, detail, and
   category payloads all exist before hashing at `:311-387`.
4. `computePublicationSourceHash()` canonicalizes the keyed set at
   `scripts/catalog-publication.ts:96-136`.
5. The digest is injected into every projection and then files are published
   at `scripts/build-json.ts:397-495`.
6. Browser summary, optimizer, category, and detail readers use
   `apps/web/src/lib/catalog-publication-identity.ts` and
   `apps/web/src/lib/cards.ts` to reject mixed generations.
7. CLI compiled-catalog loading validates the optimizer artifact before use.

Competing hypotheses checked:

- **Legacy payloads still sit outside the hash:** rejected; both are supplied
  under distinct stable keys.
- **The digest hashes itself:** rejected; metadata injection happens after
  the identity-free hash.
- **Legacy v2 and browser v1 sharing a digest is ambiguous:** rejected;
  projection schema and publication identity are separate fields.
- **A legacy-only change reuses the digest:** rejected by the two mutation
  branches in `scripts/__tests__/catalog-publication.test.ts:652-720`.
- **One generated shard has a different digest:** rejected; all checked
  artifacts carry
  `125970f582c040a0c6aa728cab49dea1173c1e7fbd96fc297876c5197291c200`.

No surviving causal failure exists in this trace.

## Trace C — module-TypeScript import to dependency-policy result

1. `.mts` and `.cts` are admitted by `SOURCE_EXTENSIONS` at
   `scripts/check-dependencies.ts:11-22`.
2. Recursive production/test discovery and top-level config discovery apply
   that one inventory at `:465-511`.
3. `collectModuleSpecifiers()` extracts static imports/exports, import types,
   `require()`, and literal dynamic imports at `:532-603`.
4. Package specifiers are normalized and compared with runtime or development
   ownership at `:605-692`.
5. The combined dependency gate joins import, vendor, lock-peer, and remote
   reference checks at `:799-832`.

Competing hypotheses checked:

- **Files are admitted but parsed as JavaScript:** rejected; the fallback
  script kind is TypeScript.
- **Config filenames remain on a separate stale regex:** rejected;
  `isConfigSourceFile()` derives from the extension set.
- **Only undeclared failure is tested:** rejected; tests cover both rejection
  and correct ownership for production, test, and config in each extension.
- **A current undeclared import was newly exposed:** rejected; the dependency
  gate passes, and no tracked `.mts`/`.cts` source exists yet.

No surviving causal failure exists in this trace.

## Trace D — analysis ownership and cancellation

The closing end-to-end trace followed file admission, bounded parse lanes,
worker creation/termination, `OperationEpoch`, analysis replacement,
optimization worker protocol, result validation, session serialization,
reoptimization, reset, and route readiness across:

- `apps/web/src/lib/file-parse-queue.ts`
- `apps/web/src/lib/operation-epoch.ts`
- `apps/web/src/lib/analysis-replacement-runtime.ts`
- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/optimizer/**`
- `apps/web/src/lib/store.svelte.ts`
- `apps/web/src/lib/persistence.ts`

Ownership is established before side effects, stale runs cannot commit, and
only a coherent validated result replaces visible state. The store's outer
catch contains C19-TR-001 at page startup but misclassifies it; no separate
lost-update, double-commit, worker leak, or stale-cache path was found.

## Historical reconciliation

Optimizer replay complexity, matcher scale, parser duplication, static-host
CSP limits, storage/privacy tradeoffs, broad orchestration, legacy payload
compatibility, and prior state/cancellation observations all retain explicit
historical owners. The Cycle 18 calendar, identity, and dependency roots are
closed at current HEAD and were not counted again.

## Classification and verification

- Confirmed new findings: one Low / High-confidence exception-closure defect,
  C19-TR-001.
- Likely new findings: none.
- Manual-validation risks promoted to findings: none.

Read-only dependency, typecheck, workspace/script test, Vitest, and web bundle
checks passed. This role launched no browser or E2E process and performed no
deployment.

## Final missed-issue sweep

The last pass searched for alternate entrypoints, unchecked casts, duplicated
constructors, invalid lower/upper boundaries, identity cycles, nondeterministic
ordering, mixed generations, stale promises, orphaned workers, missing abort
checks, unsafe sums, parser/result scope drift, source files skipped by gates,
and error paths that could commit partial state. It also reconciled every
candidate against current and archived plan/review owners.

No relevant file was skipped. C19-TR-001 is the sole new causal root that
survived.

Final new finding count: **1**.
