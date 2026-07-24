# Cycle 20 Dependency Expert Review

Date: 2026-07-24
Baseline: `c59938ee5ca5b0c5756e34907330a4eacd2898f9`
Role: Dependency expert
Mode: review only; no implementation, browser/E2E run, commit, push, or deploy

## Result

No dependency defect was found.

| Classification | Count |
| --- | ---: |
| Confirmed | 0 |
| Likely | 0 |
| Manual check required | 0 |

C20-B-001 was reviewed for dependency impact. It is a Plan 109 data-validation completion gap and requires no package, export-map, workspace-edge, dynamic-import, or runtime-ownership change.

## Inventory

The review reused the complete baseline inventory: 2,424 tracked paths, with 1,172 active paths and 1,252 archived `.context` paths.

The dependency-owned active source inventory was:

| Area | Files |
| --- | ---: |
| `apps/web` | 137 |
| `packages/core` | 45 |
| `packages/parser` | 60 |
| `packages/rules` | 21 |
| `packages/viz` | 11 |
| `packages/cli` | 26 |
| `packages/scraper` | 23 |

All 8 workspace manifests, all 8 lockfile workspace records, 567 lockfile package rows, and all 13 `workspace:*` edges were checked. No tracked `.mts` or `.cts` source remains.

The current internal graph is:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
cli     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

## Checker and manifest audit

The repository dependency checker was read in full, including its workspace inventory, manifest/lockfile matching, source ownership, import scanning, entrypoint resolution, and browser-boundary rules:

- `scripts/check-dependencies.ts:11-22`
- `scripts/check-dependencies.ts:465-510`
- `scripts/check-dependencies.ts:532-603`
- `scripts/check-dependencies.ts:605-692`
- `scripts/check-dependencies.ts:702-797`

The audit also covered:

- root and workspace `package.json` dependency declarations and scripts;
- package `exports` maps and browser-safe subpath entrypoints;
- `bun.lock`;
- build, test, Astro, Vitest, Playwright, TypeScript, and CI configuration;
- source imports in every checker-owned production tree;
- browser analyzer imports of parser/rules browser-safe entrypoints;
- build bundle guardrails and deferred-loading boundaries.

The dynamic imports are bounded and declared:

- Astro transition/client loading in the card-detail and file-dropzone paths;
- deferred analyzer/parser format modules;
- `pdfjs-dist` for PDF parsing.

No undeclared package, stale direct dependency, invalid internal edge, Node-only browser leak, export-map mismatch, ambiguous source ownership, or unbounded dynamic import was found.

## Runtime and tooling assessment

The runtime split remains coherent:

- browser code consumes explicitly browser-safe parser/rules subpaths;
- Node/Bun-only parsing and CLI/scraper paths remain outside the client graph;
- the bundle gate checks that forbidden server/runtime dependencies do not enter the web output;
- test-only and build-only tools remain declared in the appropriate workspace/root scope;
- workspace declarations and lockfile records agree.

`bun run dependencies:check` passed. `bun audit --json` returned `{}` under Bun 1.3.12 during this review.

## C20-B-001 impact assessment

The current issue is confined to monthly-bucket domain validation and persistence restoration:

- `packages/core/src/analysis/context.ts:157-175,189-205`
- `apps/web/src/lib/analysis-result.ts:926-984`
- `apps/web/src/lib/persistence.ts:822-844,867-925`

The repair should change the existing validators from accepting a zero monthly transaction count to requiring a positive one, plus tests in already-owned web test files. It should not introduce a dependency, move code across workspace ownership, add an entrypoint, or alter build/runtime boundaries.

## Historical reconciliation

Archived Plan 109 owns the coherent monthly-count/spending contract:

- `.context/plans/_archive/109-cycle8-analysis-coherence.md:17-21,23-42,44-63,65-76`

Cycle 18's module-extension and dependency-checker work was rechecked: the repository now has zero tracked `.mts`/`.cts` files and the current checker passes. Cycle 19 findings were also treated as resolved. Previously documented static-host CSP, parser duplication, performance, session-storage, mixed-runner, and coverage topics were not reissued as dependency findings.

## Verification

- Dependency checker: passed.
- Audit command: empty JSON result.
- Focused web tests: 215 tests passed with 543 expectations.
- Astro check: 126 files, zero diagnostics.
- Data validation: passed for 683 cards, 24 issuers, and 551 executable records.
- No browser, Chrome, Playwright, E2E, or deployment command was run by this role.

## Final sweep

The final manifest, lockfile, export, import, runtime-boundary, dynamic-import, configuration, and source-ownership sweep produced no additional candidate. The six protected untracked Cycle 42 artifacts were neither opened nor searched. Only this assigned report pair was changed.
