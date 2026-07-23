# Review-plan-fix Cycle 7 — verifier

**Review baseline:** `3086a379e31e5b17f82401807f5b3c24325b9962` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified and read all 2,175 tracked paths before independently verifying
the repository's current claims. The inventory contains 1,045
context/planning/review paths, 151 web paths, 868 package paths (`core` 36,
`parser` 87, `rules` 733, `viz` 12), 59 tool paths, 18 scripts, 15 E2E paths,
and 19 root/config/vendor/instruction paths. It includes 320 tracked
TS/JS/Svelte/Astro files, 147 test paths, all 683 authored card-rule YAML
files, and 72 JSON/CSV inputs or generated artifacts. A complete tracked-file
content read succeeded before this report was written.

The verifier did not treat comments or passing tests as proof. It traced and
probed statement input through server/browser parsing, categorization,
analysis context, reward calculation, optimization, worker transport,
persistence/reoptimization, dashboard/report presentation, and CLI command
processing. It separately traced authored categories/cards through schema and
semantic validation, publication hashes/artifacts, web/CLI loading, and
runtime matching. Scraper URL/write boundaries, documentation/manifests,
toolchain gates, workflows, and test claims were checked against executable
behavior. Bulk card data and generated artifacts were covered by exhaustive
validation plus direct contract queries.

Fixed Cycle 6 findings and historical/deferred work were excluded. The two
findings below are present at the reviewed HEAD and were reproduced without
editing source or fixtures.

## RPF7-VER-001 — `--categories` silently bypasses compatibility validation for the compiled card catalog

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **User-facing contract:** `tools/cli/src/command-options.ts:62-87,355-367`
- **Optimize/report flow:** `tools/cli/src/commands/optimize.ts:63-93`;
  `tools/cli/src/commands/report.ts:68-97`
- **Divergent validation:** `tools/cli/src/card-catalog.ts:31-76`
- **Missing combination coverage:**
  `tools/cli/__tests__/compiled-catalog.test.ts:23-166`

The CLI exposes `--categories` independently for all three statement commands
and says it selects the category rules to use. Optimize and report load that
file, build the merchant matcher and labels from it, then pass the categories
to `loadCliCardCatalog(cardsDir, categories)`.

The loader validates the supplied categories against cards only in authoring
mode, when `--cards` is also present (lines 36-61). In compiled mode, lines
64-76 ignore the category argument and return the fixed canonical
`cards-optimizer.json`. Neither option parsing nor the command rejects this
semantic mismatch.

An independent executable probe supplied a valid taxonomy containing only
`custom_only` and omitted the card-directory override:

```text
loadCliCardCatalog(undefined, customCategories)
  mode: compiled
  recommendation-eligible cards: 682
  first card: bc-baro-air-plus-asiana

validateCardCatalog(returnedCards, new CategoryRegistry(customCategories))
  CatalogValidationError: 2,515 issues
```

The first reported incompatibility was a card exclusion referring to canonical
category `utilities`, which does not exist in the supplied taxonomy. The
catalog loader nevertheless returned normally. Existing compiled-catalog
tests cover default compiled mode and the paired custom-cards/custom-categories
mode, but not custom categories alone.

**Concrete scenario:** an operator runs `optimize` or `report` with a reduced
company taxonomy via `--categories` and omits `--cards`. Transactions receive
custom category IDs while the optimizer evaluates canonical card rules. The
command completes with zero or wrong category rewards rather than reporting
that its two semantic inputs are unrelated.

**Root-cause fix:** for optimize/report, either require `--categories` and
`--cards` together or bind compiled category and card artifacts with a shared
source identity/hash. Reject a mismatch before categorization and optimization.
Add command-level tests for categories-only, cards-only, both overrides, and a
compiled identity mismatch.

## RPF7-VER-002 — the documented Bun-only setup passes its gate but cannot start `dev:web` without Node

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Documentation:** `README.md:139-155`
- **Root scripts/tool declaration:** `package.json:9-29,55`
- **Gate:** `scripts/check-toolchain.ts:34-45`
- **Undocumented CI prerequisite:** `.github/workflows/deploy.yml:24-30`
- **Actual web script:** `apps/web/package.json:6-12`

The local-development guide says the required tool is Bun 1.3.12, directs the
reader to verify it with `bun run toolchain:check`, and then tells them to run
`bun run dev:web`. The gate checks only `Bun.version` and the root manifest
declares only `bun@1.3.12`.

The root `dev:web` script nevertheless shells out to `node --run dev`.
Deployment installs Node 24 separately, but local documentation neither
requires nor pins Node. Two probes with a PATH containing no Node executable
show the contradiction:

```text
$ /absolute/path/to/bun run toolchain:check
Toolchain check passed: Bun 1.3.12

$ /absolute/path/to/bun run dev:web
$ cd apps/web && node --run dev
error: Module not found '.../apps/web/dev'
error: script "dev:web" exited with code 1
```

In that environment Bun's compatibility dispatch receives the unavailable
`node` invocation but does not implement Node's `--run` command semantics, so
the documented server never starts.

**Concrete scenario:** a new contributor installs exactly the sole documented
prerequisite. The official toolchain gate passes, installation and data checks
can succeed, but the next documented web-development command fails.

**Root-cause fix:** keep the repository Bun-only by changing the root script
to the already-used workspace form, `bun run --cwd apps/web dev`. If Node is
intentionally required instead, declare and pin it in documentation and the
toolchain gate, and test the documented clean-host sequence.

## Verification

- The custom-taxonomy probe confirmed that the loader returned 682 compiled
  cards and that independent semantic validation rejected the pair with 2,515
  issues.
- The Bun-only PATH probes confirmed that the official gate passes and
  `dev:web` fails.
- `bun run data:check`: **passed** for all 683 authored cards, generated
  catalogs/shards/fallback labels, and README catalog.
- `bun run typecheck`: **passed** for parser, rules, core, viz, scraper, CLI,
  and web; Astro reported 0 errors, 0 warnings, and 0 hints.
- `bun run dependencies:check` and `bun run security:audit`: **passed**.
- No source, test, plan, generated artifact, protected Cycle 42 file, branch,
  commit, deployment, or external state was changed.

## Final missed-issue sweep

The bounded final sweep rechecked each passing gate against runtime behavior,
server/browser parser parity, category and catalog identity, reward/calculator
exports, optimization caps and provenance, persistence coherence, worker
protocols, CLI help/option combinations, report output, scraper boundaries,
publication artifacts, manifests, README commands, and workflow tool setup.
No third new, non-duplicate verifier issue met the evidence threshold at this
baseline.

Final count: **1 Medium and 1 Low finding**, both confirmed with High
confidence.
