# Cycle 9 architect review

## Provenance and scope

- Specialist lens: architect — ownership, dependency direction, canonical data, persistence boundaries, and cross-layer contracts.
- Review date: 2026-07-24.
- Reviewed commit: `c5c6eab9b421e547d66716e989e08c747cc36aa1`.
- Tracked inventory: 2,232 files; sorted manifest SHA-256 `47bfbcc36706291e34da2709db76b134184c2c99fe9c25151cc8ac12de83f0d1`.
- Active inventory after excluding historical `.context` plan/review bodies: 1,153 files; manifest SHA-256 `593f6630e814f550d7db85b63685c91a3056e0abf7aedce18e82ede9ba5377e8`.
- This review traced the current tree independently and used historical material only to distinguish new/current residue from already repaired findings.

## Repository inventory and architecture coverage

The complete active inventory comprises:

- `apps/web` — 166 tracked files: Astro routes/layout, Svelte UI, analysis domain/runtime, persistence, browser parsers/workers, catalog readers, generated public artifacts, tests, and configuration.
- `packages/core` — 38 tracked files: categorization, calculation, models, optimizer, analysis context, tests, and package configuration.
- `packages/parser` — 85 tracked files: all format adapters and shared kernels, browser/server entry points, 48 tests/fixtures, and configuration.
- `packages/rules` — 733 tracked files: schema/validation/loading/publication logic, tests, 24 issuer documents, indexes, and all 683 card-rule YAML files.
- `packages/viz`, `tools/cli`, `tools/scraper`, `scripts`, and `e2e` — 112 tracked files covering output generation, command and network/I/O boundaries, migrations/publication checks, runtime harnesses, tests, fixtures, and target configuration.
- 19 root/policy/workflow/vendor/other files, including all manifests, lock/toolchain policy, Astro/Playwright/Turbo/TypeScript configuration, GitHub workflow, README, and vendored archives.

The main dependency/data flows inspected were:

`statement -> parser/worker -> categorized transactions -> rules/core optimizer -> AnalysisResult -> persistence/store -> dashboard/results/report`

and:

`card YAML -> rules schema/catalog validation -> publication scripts -> browser/CLI catalogs -> calculator/optimizer`.

The 683 card YAML files and generated publication artifacts were covered through their owning schema/publication boundaries and green repository gates. Historical `.context` bodies, `.git`, caches, dependencies, and generated build directories were excluded from finding generation.

Verification:

- `bun run lint` — passed.
- `bun run typecheck` — passed with zero Astro diagnostics.
- `bun run test` — passed across all workspaces and 69 root script tests.
- No browser/E2E run was performed by this lens.

## Finding

### C9-AR-01 — The persisted snapshot validates derived data against itself, not against canonical transaction facts

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `apps/web/src/lib/analysis-result.ts:136-283`
  - `apps/web/src/lib/analysis-result.ts:326-456`
  - `apps/web/src/lib/persistence.ts:142-163`
  - `apps/web/src/lib/persistence.ts:200-280`
  - `apps/web/src/lib/persistence.ts:629-827`

Failure scenario:

A stale, partially written, or otherwise corrupted version-3 `sessionStorage` snapshot can remain internally balanced while contradicting its transactions. It is then restored as trusted analysis data. Examples include:

1. The current-month transaction remains `dining`, while both the assignment and `cardResults[].byCategory` are changed to `grocery`.
2. Three positive current-month transactions contain two unassigned rows, but the snapshot reports only one unassigned transaction while preserving the correct 10,000-won unassigned total.
3. A card reports a fabricated cap category with `actualReward: 0`, `appliedReward: 999999`, and an unrelated one-won cap, while its category row independently claims the cap was reached.
4. When the serializer drops transactions above the four-megabyte limit, monthly spending can contradict optimizer spending because the truncated branch has no remaining canonical facts with which to reconcile the derived objects.

Executable evidence:

Direct calls against the current `isAnalysisResultCoherent` returned:

```text
baseline true
transaction=dining optimizer=grocery true
2 unassigned rows reported as 1 true
fabricated contradictory cap telemetry true
```

A separately constructed structurally valid truncated version-3 payload used a 999,999-won latest monthly breakdown and a 10,000-won optimizer snapshot. `deserializeAnalysis` returned non-null data, `warningKind: "truncated"`, and `shouldRemove: false`.

Rationale:

The new invariant layer correctly closes many Cycle 8 aggregate-total gaps, but its source of truth is still a graph of derived optimizer objects:

- Assignments are reconciled with card results, but their categories are not reconciled with latest-month transactions.
- Unassigned spending is reconciled arithmetically, but exact mixed-case row count cannot be derived from the persisted aggregate shape.
- Cap objects receive primitive/range validation but no relationship validation.
- The truncation projection intentionally destroys the transaction source while retaining multiple independently mutable derivations.

These are manifestations of one architectural gap: the persistence schema does not retain a minimal canonical analysis summary that can prove the stored derivations. Adding isolated comparisons will keep leaving cases that the shape cannot express.

Suggested fix:

Introduce a versioned, framework-free persisted snapshot contract with canonical latest-month aggregates, at minimum:

- Per-category positive spending and transaction counts.
- Per-category unassigned spending and counts, or explicit unassigned transaction identities.
- Latest/full month totals and periods.
- A coherent cap outcome representation whose `actualReward`, `appliedReward`, cap type/category, and category telemetry are checked or recomputed.

Reconcile assignments and card results against those facts, not merely against each other. For truncated storage, retain this compact canonical summary before dropping transaction rows and optionally store a digest over the projection to detect accidental partial mutation. If cap telemetry is not needed by the web snapshot, omit it and recompute from canonical inputs instead of persisting unverifiable derived state.

Add mutation tests for paired relabeling, mixed assigned/unassigned counts, contradictory cap records, and truncated monthly/optimizer divergence. The validator should reject each while continuing to accept a genuine serializer round trip.

## Final missed-issue sweep

The final architecture pass revisited package direction, parser/browser ownership, worker protocols, rules-to-publication boundaries, analysis construction and replacement, persistence migrations, store restoration, optimizer result ownership, UI/report consumers, CLI/scraper separation, manifests, and CI. The previously fixed framework-free analysis contract, parser ownership boundaries, navigation state, and catalog executability changes remain in place. No second architectural finding met the current-evidence threshold.

Findings: 1 total — 1 Medium.
