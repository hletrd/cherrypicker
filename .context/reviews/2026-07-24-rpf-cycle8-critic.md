# Cycle 8 critic review

## Provenance and scope

- Specialist lens: critic — whole-repository review from end-user, operator, test, data, product, and maintenance perspectives.
- Review date: 2026-07-24.
- Reviewed commit: `3fd993d471a8676170031f20715f6a53c99e8a9f`.
- Findings were derived from the current tree and direct reproductions. Historical review text was not recycled.

## Repository inventory and coverage

The tracked tree has 2,199 files: 1,090 Markdown, 685 YAML, 293 TypeScript, 59 JSON, 14 Svelte, 14 JavaScript, 13 CSV, 6 Astro, 5 HTML, and smaller configuration, fixture, image, archive, and financial-format families. The active code/test classification covered 198 non-test code files and 155 test/fixture files under the application, packages, tools, scripts, and E2E roots. All 683 card YAML records and their generated 682-card optimizer artifact were included as a data family.

The pass followed the user-visible flow from statement ingestion through parsing, categorization, optimization, persistence, dashboard/results/report presentation, catalog/card-detail navigation, CLI/report use, scraper publication, and build/test/release checks. It also examined root documentation, manifests, workspace policy, CI, test distribution, fixture coverage, generated artifacts, and historical `.context` only as an inventoried documentation family.

Verification at the reviewed commit:

- `bun run lint`, `bun run typecheck`, and `bun run test` all passed.
- The web typecheck reported zero errors, warnings, or hints.
- Browser and E2E suites were intentionally not run.

## Findings

### C8-CT-01 — Activating the skip link from a card detail closes the detail view

- Severity: Medium
- Confidence: High
- Status: Confirmed by deterministic cross-file control flow; browser execution was intentionally not performed
- Exact region:
  - `apps/web/src/components/cards/CardPage.svelte:40-45`
  - `apps/web/src/components/cards/CardPage.svelte:67-77`
  - `apps/web/public/scripts/layout.js:64-71`
  - `apps/web/src/layouts/Layout.astro:74-75`
  - `apps/web/src/layouts/Layout.astro:188-190`
  - Coverage gap: `e2e/catalog-request-boundaries.spec.js:79-100` and `e2e/web-regressions.spec.js:180-205`

Failure scenario:

A keyboard user opens a card detail, whose selection is encoded as `#card=<id>`, tabs to “본문으로 건너뛰기”, and activates it. The layout changes the fragment to `#main-content`. The card page's `hashchange` synchronization treats every non-card fragment as “show the list”, clears `selectedCardId`, and resets the title. The user lands at the main landmark, but the content they intended to navigate within has disappeared and the card grid is shown instead.

Evidence:

- `selectCard` writes the card selection into `window.location.hash`.
- `syncSelectionFromHash` clears the selection whenever `parseCardSelectionHash` returns no card.
- The global skip link deliberately writes `#main-content` on the same document.
- Existing E2E coverage activates the skip link before selecting a card or on the plain `/cards` route; it does not cover the detail-state transition.

Recommended fix:

Do not use the same fragment as both application view state and landmark navigation. Prefer a path or query parameter for the selected card, or retain selection in route/history state while reserving fragments for document targets. If the hash contract must remain, make the hash handler distinguish landmark-only navigation without clearing the current selection, and define explicit Back/list behavior separately. Add an E2E regression that selects a card, activates the skip link, verifies main focus, and verifies that the same detail remains visible.

### C8-CT-02 — Unsupported-only and zero-benefit cards can become recommendation winners

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Exact region:
  - `packages/rules/src/card-availability.ts:3-10`
  - `packages/core/src/optimizer/greedy.ts:103-114`
  - `packages/core/src/optimizer/greedy.ts:304-314`
  - `packages/core/src/optimizer/greedy.ts:359-388`
  - `packages/core/src/optimizer/greedy.ts:423-444`
  - `packages/core/__tests__/optimizer.test.ts:353-389`
  - Data artifact: `apps/web/public/data/cards-optimizer.json`

Failure scenario:

When all candidate cards calculate to zero reward—for example, because every modeled reward is marked unsupported, no tier applies, or amounts round to zero—the optimizer still assigns every transaction to the lexicographically first card and labels a zero-reward card as `bestSingleCard`. The UI/CLI can therefore present an arbitrary card as a recommendation even though the system has no modeled benefit supporting it.

Evidence:

- Recommendation eligibility excludes only `discontinued: true`; it does not require an executable supported benefit.
- The scoring loop includes zero scores, takes `scores[0]`, and records that card as the assignment.
- The best-single loop likewise resolves zero ties by ASCII card ID.
- The optimizer artifact contains 682 cards; 116 have rewards but every reward's support status is `unsupported`.
- A one-won uncategorized transaction with the full artifact selected `bc-baro-air-plus-asiana`, returned zero reward, and emitted unsupported-rule evidence. The test suite explicitly codifies zero-reward assignments and ASCII tie-breaking, so this is a current product-contract problem rather than an accidental nondeterminism.

Recommended fix:

Separate catalog availability from optimization executability. Define an optimization-candidate predicate requiring at least one supported, executable reward path, while keeping unsupported cards visible in catalog/detail views. At scoring time, represent “no positive modeled benefit” explicitly rather than forcing an assignment; the result/UI should say no modeled benefit or unassigned, and should not call an arbitrary zero-tie card the best. Replace the current zero-assignment expectation with tests for the explicit no-benefit contract, including an unsupported-only data fixture.

### C8-CT-03 — Session restoration can display mutually contradictory financial totals

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Exact region:
  - `apps/web/src/lib/persistence.ts:186-303`
  - `apps/web/src/lib/persistence.ts:573-684`
  - `apps/web/src/lib/persistence.ts:710-745`

Failure scenario:

A partially written, stale-version-derived, extension-modified, or manually edited session payload can independently change counts, monthly totals, spending, rewards, and rates while retaining valid primitive types. The dashboard restores the object, so different panels can tell the user different stories about the same analysis.

Evidence:

- Restoration performs thorough shape/range validation but does not reconcile related fields.
- A serialized valid result whose count, optimization totals, and monthly summary were changed to unrelated safe nonnegative values was accepted with `shouldRemove: false`.
- The current type cast at `persistence.ts:731` makes structural acceptance the final gate even though the value represents calculated financial state.

Recommended fix:

Add a post-migration semantic invariant check shared by result construction and persistence restoration. Recompute or reconcile derived values from the least-derived retained data, reject incoherent records, and add one-mutation-at-a-time corruption tests. Where transaction arrays are deliberately truncated, encode that state explicitly and validate only the invariants that remain provable.

### C8-CT-04 — A copyable root-help command is guaranteed to fail

- Severity: Low
- Confidence: High
- Status: Confirmed
- Exact region:
  - `tools/cli/src/index.ts:21-26`
  - `tools/cli/src/command-options.ts:330-337`

Failure scenario:

A first-time CLI user copies `cherrypicker optimize statement.csv --cards ./rules/` from the built-in help and immediately gets an error requiring `--categories` as well. This makes the primary self-service documentation contradict the executable contract.

Evidence:

- The example supplies only `--cards`.
- The parser requires `--categories` and `--cards` as a pair for `optimize` and `report`.
- Direct execution exits 1 with that exact pair-requirement error.

Recommended fix:

Print both paths in the example and test root-help examples against option parsing. Prefer generating command examples from a single typed command-definition source so prose and enforcement change together.

## Final missed-area sweep

The final pass rechecked source/test asymmetries, inaccessible/error states, data-to-generated-artifact publication, CLI/doc promises, zero/empty boundary behavior, restoration/migration behavior, and cross-package browser/server parity. No additional issue met the evidence threshold without browser work or speculation. Findings: 4 total — 3 Medium, 1 Low.
