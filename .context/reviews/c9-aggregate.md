# Cycle 9 — Aggregate Review (2026-04-24)

Deduplicated findings across `code-reviewer`, `perf-reviewer`, `security-reviewer`, `architect`, `test-engineer`, `designer`, `debugger`, `critic`, `verifier`, `tracer`, and `document-specialist`.

Provenance files retained at `.context/reviews/c9-<agent-name>.md`.

## MEDIUM — implement in this cycle

| Id | Source agents | File:line | Description |
|----|---------------|-----------|-------------|
| C9-01 | code-reviewer C9-CR01, architect C9-A01, critic C9-CT01, tracer C9-T01 | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87` | **CATEGORY_COLORS is a fourth hardcoded duplicate of the YAML taxonomy.** 80-entry Record mapping category IDs to hex colors. Same drift risk as C7-01/C7-02/C8-01. When the taxonomy adds or renames a category, this map must be manually updated in lockstep or new categories silently render gray. Also contains the entertainment.subscription inconsistency from C7-04. |
| C9-02 | code-reviewer C9-CR02, architect C9-A02, tracer C9-T02 | `apps/web/src/components/upload/FileDropzone.svelte:80-105` | **ALL_BANKS in FileDropzone duplicates parser bank signatures.** 24-entry array of bank IDs and labels that must be updated in lockstep with `packages/parser/src/detect.ts`. New banks added to the parser won't appear in the manual bank selector. |

## LOW — plan-only or deferred

| Id | Source agents | File:line | Severity | Description |
|----|---------------|-----------|----------|-------------|
| C9-03 | code-reviewer C9-CR03 | `apps/web/src/lib/formatters.ts:52-79` | LOW | **formatIssuerNameKo duplicates issuer name data from cards.json.** 23-entry Record mapping issuer IDs to Korean names. Must be updated in lockstep when issuers change. |
| C9-04 | code-reviewer C9-CR04 | `apps/web/src/lib/formatters.ts:115-143` | LOW | **getIssuerColor duplicates issuer color data.** 23-entry Record mapping issuer IDs to hex colors. Must be updated in lockstep when issuers change. |
| C9-05 | code-reviewer C9-CR06 | `apps/web/src/lib/formatters.ts:85-110` | LOW | **getCategoryIconName duplicates taxonomy icon mapping.** Maps category IDs to icon names. New categories fall through to 'credit-card'. |
| C9-06 | code-reviewer C9-CR05 | `packages/core/src/optimizer/constraints.ts:16` | LOW | **buildConstraints creates unnecessary shallow copy of transactions.** The spread `[...transactions]` is defensive but the optimizer only reads from this array, never mutates it. |
| C9-07 | perf-reviewer C9-P01 | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:120` | LOW | **CategoryBreakdown re-sorts assignments on every render even when sort key matches optimizer default.** Redundant O(n log n) per render when sortKey is 'spending'. |
| C9-08 | test-engineer C9-TE01 | `apps/web/src/lib/category-labels.ts:7-26` | LOW | **No test coverage for buildCategoryLabelMap edge cases.** Empty nodes, empty subcategories, id collisions are untested. |
| C9-09 | test-engineer C9-TE02 | `apps/web/src/lib/store.svelte.ts:146-330` | LOW | **No test coverage for sessionStorage persistence/recovery.** Complex truncation, validation, migration, and error handling logic is untested. |
| C9-10 | document-specialist C9-DS02 | `apps/web/src/lib/build-stats.ts:16-18` | LOW | **Fallback stats values (683 cards, 24 issuers, 45 categories) may become stale.** Not auto-updated when card data changes. |

## Security — no new findings

No new HIGH or MEDIUM security findings. Previously deferred items (D-32, D-31, D-107, D-109, D7-M13) remain valid. CSP 'unsafe-inline' is acknowledged and tracked in Layout.astro TODO.

## Cross-agent agreement

- **code-reviewer + architect + critic + tracer** converge on C9-01 (CATEGORY_COLORS as 4th taxonomy duplicate). 4 agents. Critic notes this is the 6th consecutive cycle with the same systemic pattern, recommending a dedicated build-time generation mini-cycle.
- **code-reviewer + architect + tracer** converge on C9-02 (ALL_BANKS duplicates parser bank list). 3 agents.
- **code-reviewer alone** identified C9-03, C9-04, C9-05 (3 more hardcoded duplicates in formatters.ts). These expand the scope of the systemic pattern identified by C9-01.

## Systemic pattern: 7 hardcoded-taxonomy-duplicate instances

The aggregate count of hardcoded maps duplicating taxonomy or issuer data is now **7**:

1. CATEGORY_NAMES_KO (greedy.ts) — tracked as C7-01
2. FALLBACK_CATEGORY_LABELS (category-labels.ts) — tracked as C7-02
3. FALLBACK_GROUPS (TransactionReview.svelte) — tracked as C8-01
4. CATEGORY_COLORS (CategoryBreakdown.svelte) — **new** C9-01
5. formatIssuerNameKo (formatters.ts) — **new** C9-03
6. getIssuerColor (formatters.ts) — **new** C9-04
7. getCategoryIconName (formatters.ts) — **new** C9-05

All 7 share the same root cause and the same fix: build-time generation from YAML/JSON source data.

## Verification evidence

- `npm run lint` — PASS (exit 0)
- `npm run typecheck` — PASS (exit 0)
- `bun run test` — PASS (FULL TURBO, 10/10 cached)
- C8-02 fix verified by verifier: bucket registration order correct

## Previously Deferred (Acknowledged, Not Re-reported)

All items in `.context/plans/00-deferred-items.md` remain valid. No regression found.

## Plan hand-off

See `.context/plans/` for implementation plans derived from this aggregate.
