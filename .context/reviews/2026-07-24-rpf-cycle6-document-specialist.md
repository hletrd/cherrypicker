# Cycle 6 document-specialist review

- Review date: 2026-07-24
- Reviewed commit: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Status: review only; no source, generated data, plan, deployment, or protected Cycle 42 artifact was changed
- Result: **2 open findings** (`C6-DOC-001`, `C6-DOC-002`, both medium)

## Inventory and authoritative-source checks

All 2,165 tracked paths were inventoried. The document pass exhaustively covered the 29 current non-`.context` Markdown files (root README, both `.claude` guides, all 24 issuer READMEs, and `vendor/README.md`), the root/workspace manifests and TypeScript configs, Bun/Turbo/Vitest/Playwright/Astro configuration, the Pages workflow, the catalog/document generators, canonical issuer/category/card YAML, every checked-in catalog projection, all 24 detail shards, and the generated category fallback module. Historical `.context` plans/reviews and `.omc` plan material were inventoried but not treated as current product truth; the untracked protected Cycle 42 artifacts were not touched.

Authoritative checks completed:

- `bun run data:check` verified **683 cards / 24 issuers** and byte equality for `packages/rules/data/cards{,-compact}.json`, all web catalog projections, all 24 issuer detail shards, categories, the generated fallback module, the root issuer table, and every issuer index.
- Every issuer README's hand-written count equals its YAML file count; every hand-written backticked YAML reference resolves; the sole discontinued card is marked in its BC README.
- Root README format aliases, CLI examples, recommendation disclosures, Astro 7 claim, issuer totals, and validated YAML example agree with source/config and the existing truth checks.
- `.claude/AGENTS.md` lists the same 24 issuer IDs as `issuers.yaml`; its taxonomy/source locations and validated YAML example agree with the repository.
- `vendor/README.md`, the two `xlsx` consumer manifests, the committed SHA-256 file, and the actual archive digest agree.

## Findings

### C6-DOC-001 — The agent architecture guide still identifies the web app as Astro 6

- Severity: **Medium**
- Confidence: **High**
- Status: **Open**
- Exact region: `.claude/CLAUDE.md:7,22`
- Authoritative source: `apps/web/package.json:15-23` declares `astro: ^7.1.3`; `README.md:98` correctly says Astro 7.
- Concrete failure: both the tech-stack summary and architecture entry tell agent/tooling consumers that the web app is Astro 6. A contributor following the repository's dedicated agent context can therefore apply Astro 6 APIs, migration assumptions, or dependency constraints to an Astro 7 application even though the public README is correct.
- Suggested fix: update both guide claims to Astro 7 and include `.claude/CLAUDE.md` in the existing manifest-derived Astro-major truth check so the two documentation surfaces cannot diverge again.

### C6-DOC-002 — The catalog generator and generated source prescribe a command that cannot run

- Severity: **Medium**
- Confidence: **High**
- Status: **Open**
- Exact region: `scripts/build-json.ts:1-5,16`; `scripts/build-json.ts:445-460`; `apps/web/src/lib/category-labels-fallback.ts:1-3`
- Authoritative source: `package.json:19-20` defines the supported commands as `bun scripts/build-json.ts` through `bun run data:build` / `bun run data:check`.
- Concrete failure: the source usage block, Node shebang, generator template, and checked-in generated fallback header all recommend `node --experimental-strip-types scripts/build-json.ts`. Running that exact command under the repository's configured Node 24.14.0 fails immediately: Node cannot resolve the source import `../packages/core/src/categorizer/matcher.js` (the checked-in file is `.ts`) and throws `ERR_MODULE_NOT_FOUND`. Anyone obeying the generated “do not edit” instruction cannot regenerate the file.
- Suggested fix: make Bun the consistent executable contract (`#!/usr/bin/env bun`) and document `bun run data:build` for full regeneration, or `bun scripts/build-json.ts` if a generator-only command is intentionally supported. Change the template, regenerate the fallback module, and add a contract assertion for the emitted instruction.

## Bounded missed-issue sweep

The final sweep rechecked all version/runner claims, generator commands, marker pairs, issuer counts and YAML links, vendored dependency claims, canonical format aliases, and generated/source hashes. Generated catalog and README state is clean; no unmatched markers, stale shards, missing issuer README, bad YAML link, issuer-count drift, vendor checksum drift, or additional current version claim was found. The sweep produced no finding beyond `C6-DOC-001` and `C6-DOC-002`.
