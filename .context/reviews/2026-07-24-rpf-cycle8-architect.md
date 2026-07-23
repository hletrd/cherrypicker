# Cycle 8 architect review

## Provenance and scope

- Specialist lens: architect — ownership, dependency direction, coupling, layering, and contract placement.
- Review date: 2026-07-24.
- Reviewed commit: `3fd993d471a8676170031f20715f6a53c99e8a9f`.
- This review independently traced current dependency and data-flow boundaries; it does not repeat historical findings merely because they existed before.

## Repository inventory and architecture map

The tracked inventory contains 2,199 files, dominated by 1,090 documentation files, 685 YAML domain-data files, 293 TypeScript files, and the Astro/Svelte/JavaScript web surface. Under the active application/package/tool/script/E2E roots, the review classified 198 non-test code files and 155 test/fixture files. The card domain contains 683 source YAML files and generated browser artifacts, including a 682-card optimizer catalog.

Architectural families traced:

- `apps/web`: Astro shell/routes, Svelte islands, application state, persistence, browser parsing/workers, catalog repositories, and static runtime scripts.
- `packages/core`: domain calculation, optimization, categorization, models, and contracts.
- `packages/parser`: server and browser-safe parsing kernels, format adapters, shared transaction facts, and conformance fixtures.
- `packages/rules`: schemas, data validation/loading, recommendation availability, source YAML, and generated-publication contracts.
- `packages/viz`, `tools/cli`, `tools/scraper`, root build/migration/publication scripts, E2E/runtime harnesses, manifests, CI/configuration, README, and `.context` documentation/provenance.
- Generated, cache, lock, vendor, image/archive, and financial fixture families were inventoried and evaluated at their ownership/publication boundary.

The principal flow inspected was:

`statement input -> parser/browser worker -> categorized transaction -> core optimizer + rules -> AnalysisResult -> store/persistence -> dashboard/results/report`

as well as:

`rule YAML -> schema/publication scripts -> browser catalog artifacts -> card catalog/optimizer`.

Verification at the reviewed commit:

- `bun run lint`, `bun run typecheck`, and `bun run test` passed.
- No browser or E2E execution was performed.

## Findings

### C8-AR-01 — Parser contracts are duplicated across package and application layers

- Severity: Medium
- Confidence: High
- Status: Likely maintenance failure; the current copies are confirmed equal by tests
- Exact region:
  - `packages/parser/src/types.ts:1-15`
  - `apps/web/src/lib/parser/types.ts:1-20`
  - `packages/parser/src/xlsx/adapters/index.ts:12-168`
  - `apps/web/src/lib/parser/xlsx.ts:53-208`
  - `packages/parser/__tests__/conformance/cycle7-parser-direction.test.ts:9-16`
  - `packages/parser/__tests__/xlsx-parity.test.ts:2-42`

Failure scenario:

Adding a bank, changing a bank's XLSX columns, or changing a parse contract requires coordinated edits in the parser package and the web application. If a consumer is built/tested without the repository-wide parity suite, the server/CLI path and browser path can accept different inputs or classify the same statement differently. The package also cannot be validated in isolation because package tests reach upward into `apps/web` internals.

Evidence:

- `FileFormat` and the 24-member `BankId` union are independently declared in both layers.
- The complete bank XLSX column configuration is independently declared in both layers.
- Parser-package conformance/parity tests import browser implementations by relative paths from `apps/web`, reversing the intended dependency direction.
- The tests currently prove equality, but equality enforced after duplication is weaker ownership than a single exported contract: every change still has two production edit sites.

Recommended fix:

Move the canonical unions, bank adapter configuration, and pure format kernels into browser-safe exports of `@cherrypicker/parser`. Keep `apps/web` responsible only for `File`, worker, progress, and UI-warning adaptation. Package tests should test package-owned contracts; web tests should consume the public package entry point rather than serving as the second implementation under a package test. Add dependency-policy enforcement that forbids `packages/**` imports from `apps/**`.

### C8-AR-02 — The analysis domain result is owned by the Svelte store, creating an inverted source-level dependency cycle

- Severity: Medium
- Confidence: High
- Status: Confirmed architectural coupling; no runtime initialization failure was observed
- Exact region:
  - `apps/web/src/lib/store.svelte.ts:4-31`
  - `apps/web/src/lib/store.svelte.ts:53-87`
  - `apps/web/src/lib/analyzer.ts:20-30`
  - `apps/web/src/lib/persistence.ts:1-9`
  - `apps/web/src/lib/persistence.ts:573-745`

Failure scenario:

Any non-UI producer or validator of `AnalysisResult` must depend on a Svelte rune module: `analyzer.ts` imports the contract from the store, while the store loads the analyzer; `persistence.ts` imports the contract from the store, while the store imports persistence. Much of this is type-only or dynamically loaded, so it avoids an immediate initialization crash, but domain construction, state ownership, and serialization cannot evolve independently. The current persistence code consequently validates field shapes locally and casts to the store-owned result without a shared semantic contract.

Evidence:

- The calculated result DTO is declared inside `store.svelte.ts`, whose stated responsibility is Svelte state.
- Analyzer and persistence both consume that UI-owned type.
- The store has runtime dependencies back to persistence and a lazy runtime dependency back to analyzer.
- `deserializeAnalysis` ends with `optimization as unknown as AnalysisResult['optimization']`, demonstrating that the boundary lacks a domain-owned parse/invariant API.

Recommended fix:

Extract a framework-free `analysis-result.ts` (or a core/web-domain contract package) containing the DTO, schema/version contract, and semantic invariant validator. The analyzer should produce it; persistence should parse/migrate/validate it; the Svelte store should consume it. Keep storage warnings and Svelte operations in their current adapters. Enforce a one-way dependency:

`domain contract <- analyzer/persistence <- Svelte store`.

### C8-AR-03 — A single URL fragment channel owns both application view state and document navigation

- Severity: Medium
- Confidence: High
- Status: Confirmed design collision
- Exact region:
  - `apps/web/src/components/cards/CardPage.svelte:40-55`
  - `apps/web/src/components/cards/CardPage.svelte:67-77`
  - `apps/web/public/scripts/layout.js:64-71`
  - `apps/web/src/layouts/Layout.astro:74-75`
  - `apps/web/src/layouts/Layout.astro:188-190`

Failure scenario:

Card selection occupies `#card=<id>`, while the global accessibility shell needs `#main-content`. Moving to the landmark necessarily overwrites selection, and the card feature interprets that overwrite as a request to close the detail. Future anchor links would create the same collision.

Evidence:

- The card page uses hash assignment as its history/view-state mechanism.
- Its hash synchronization maps every hash outside the `#card=` namespace to list state.
- The layout independently owns the same fragment slot for skip-link focus.
- This is not merely an event-order bug: a URL has only one fragment, so the two owners cannot represent their states simultaneously.

Recommended fix:

Give application state a route or query representation and reserve fragments for document targets. For example, use `/cards/<id>` or `/cards?card=<id>` for detail state, with `#main-content` remaining composable. Centralize URL-state parsing in one router-level adapter and keep the layout's landmark behavior independent. Cover detail selection, skip-link focus, Back, reload, and deep linking as a single navigation contract.

### C8-AR-04 — Catalog availability is reused as optimizer executability

- Severity: Medium
- Confidence: High
- Status: Confirmed boundary mismatch
- Exact region:
  - `packages/rules/src/card-availability.ts:3-10`
  - `packages/core/src/optimizer/greedy.ts:103-114`
  - `packages/core/src/optimizer/greedy.ts:304-314`
  - `packages/core/src/optimizer/greedy.ts:359-388`
  - `packages/core/src/optimizer/greedy.ts:423-444`
  - `packages/core/__tests__/optimizer.test.ts:353-389`

Failure scenario:

The catalog-level statement “this card is not discontinued” is treated as the optimizer-level statement “this card has a model the engine can recommend.” Unsupported-only cards enter scoring, and when all scores are zero the optimizer chooses one by ASCII ID. The presentation layer receives a structurally normal assignment even though no modeled benefit justified it.

Evidence:

- `isRecommendationEligibleCard` has one criterion: `discontinued !== true`.
- Greedy optimization filters only through that predicate, includes zero scores, and always chooses the first score and a best-single card.
- Of 682 generated optimizer cards, 116 contain rewards whose support status is entirely `unsupported`.
- Tests intentionally stabilize zero-reward card assignment, confirming that the semantic distinction is absent from the result contract.

Recommended fix:

Model separate capabilities:

- Catalog-visible/historical.
- Open for new applications or recommendations.
- Fully/partially executable by the calculator.
- Applicable to the current transaction set.

The rules/publication layer should expose those capabilities explicitly; the optimizer should accept only executable candidates and should return a first-class no-benefit/unassigned state when no positive supported score exists. Presentation layers can then explain unsupported cards without accidentally recommending them.

## Final missed-area sweep

The final architecture sweep checked package manifests and dependency policy, public entry points, package-to-app test imports, state/persistence cycles, worker boundaries, generated-data ownership, navigation/history ownership, and CLI/scraper separation. No additional coupling risk was included unless a current cross-file dependency and a concrete failure mode were both identifiable. Findings: 4 total — all Medium.
