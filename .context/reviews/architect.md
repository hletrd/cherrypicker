# Cycle 3 — Architect

**Review target:** `614ce5c`
**Lens:** ownership boundaries, canonical data paths, publication atomicity, runtime/build parity, cache identity, and failure containment.

## Inventory and boundary map

The shared Cycle 3 inventory covered 1,067 current non-historical artifacts across the Astro/Svelte web app, core/parser/rules/viz packages, CLI and scraper tools, build/publication scripts, workflows, and E2E/tests. I traced these cross-package paths:

1. Statement file → browser/server parser → transaction facts → categorizer → optimizer → session persistence → dashboard/results/report.
2. Rule YAML + taxonomy + issuers → validation → generated summary/optimizer/detail/category artifacts → browser readers and caches.
3. CLI command → parser → raw source catalog → core analysis/report output.
4. Workspace manifests/exports → root task graph → CI/deploy gates.

Cycle 2’s canonical transformed-catalog return, unified operation epoch, statement-only parser entry, and first-artifact publication pin are present. The findings below are residual boundaries not closed by those changes.

## Findings

### C3-ARCH-001 — Publication identity does not identify the bytes or generator contract being published

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed residual defect
- **Location:** `scripts/catalog-publication.ts:71-91`; `scripts/build-json.ts:284-289,418-435`; `apps/web/src/lib/cards.ts:100-105,131-141`
- **Concrete failure scenario:** A deployment changes summary/optimizer/detail projection logic or its validation/schema without changing YAML, categories, issuer data, or the hard-coded `1.0.0` version. The new artifacts receive the same `sourceHash` as the old deployment. An already-open page or intermediary cache can therefore combine old and new shards; `acceptSourceHash()` accepts all of them as one atomic publication even when their shapes or semantics no longer agree.
- **Evidence:** `computePublicationSourceHash()` hashes only `{version, categories, issuers}`. Generator code, schema revision, and the normalized serialized summary/optimizer/detail/category payloads are not inputs. `build-json.ts` computes that hash before projecting and writing the runtime artifacts. The browser pins the first accepted hash and tests only equality for later artifacts, so it cannot distinguish two builds with identical source data but different output code. This leaves the central guarantee introduced in Cycle 2 incomplete.
- **Suggested fix:** Derive a publication ID from the actual normalized artifact payload set (excluding the identity field to avoid a cycle), or from source data plus an automatically generated schema/generator revision. Embed the resulting content/build ID in every artifact and shard. Add a test that changes projection output while holding source data constant and requires a different publication ID, plus a mixed-old/new artifact rejection test.

### C3-ARCH-002 — The default CLI bypasses the canonical compiled runtime catalog

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `tools/cli/src/commands/optimize.ts:97-127`; `tools/cli/src/commands/report.ts:104-133`; `packages/rules/src/loader.ts:17-52`; `scripts/build-json.ts:418-435`; browser consumer `apps/web/src/lib/cards.ts:338,449-473`
- **Concrete failure scenario:** A publication rule, projection normalization, or artifact-level validation changes. The web analyzer consumes `cards-optimizer.json`, while the default CLI continues to reconstruct its catalog directly from 683 authoring files. Both surfaces can then claim to analyze the same repository release through different runtime contracts, and only one exercises publication identity and artifact validation.
- **Evidence:** The build has an explicit “optimizer-ready” generated artifact and the web analyzer loads it. `optimize` and `report`, however, default to `DEFAULT_CARDS_DIR` and call `loadAllCardRules()`; only an explicit custom directory is needed for source-authoring workflows. This also creates the measured startup/RSS cost documented as `C3-PERF-002`, but the architectural defect is the duplicated canonical runtime path.
- **Suggested fix:** Define one versioned optimizer-catalog reader owned by the rules/publication boundary and use it in both web and default CLI flows. Preserve `--cards` as an explicit development/source override with a clear diagnostic. Add parity tests that run one fixture through generated-artifact web/CLI inputs and compare normalized results.

## Missed-issue sweep

The final sweep rechecked cache singletons and abort ownership, page-session publication pinning, parser exports, generated shard reconciliation, task-graph dependencies, CLI/web result preparation, and package directionality. I did not re-report the category artifact validation defect found independently by the Cycle 3 code reviewer, nor the known deferred optimizer/matcher redesigns. No further architecture issue met the evidence threshold.
