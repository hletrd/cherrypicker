# Review-plan-fix Cycle 17 — document specialist

## Review identity

- Date: 2026-07-24
- Reviewed revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: public claims, maintainer instructions, generated documentation,
  manifests and workflow contracts, code comments, user-visible diagnostics,
  and code/document agreement
- Disposition: **no genuinely new documentation finding**
- Confidence: High
- Scope: review and this report only; no product, test, generated-data, plan,
  dependency, configuration, deployment, or external-system change

## Inventory and method

The exact revision contains 2,374 tracked paths: 1,204 historical
review/plan paths under `.context` and 1,170 active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths.

The current non-`.context` Markdown inventory is 29 files:

- `README.md`;
- `.claude/AGENTS.md` and `.claude/CLAUDE.md`;
- `vendor/README.md`;
- the 24 issuer READMEs under `packages/rules/data/cards/*`; and
- `.omc/plans/cycle14-fixes.md`, which is a completed historical work record,
  not current product documentation.

The review read all 29 files and reconciled their claims against:

- all eight root/workspace manifests, `bun.lock`, `bunfig.toml`, `turbo.json`,
  TypeScript, Astro, Vitest, and both Playwright configurations;
- `.github/workflows/deploy.yml`, root command routing, package scripts, and
  E2E ownership;
- the category/card/issuer schemas, all 683 authored card paths, the
  documentation and catalog generators, generated JSON projections, 24
  detail shards, and generated fallback-label module;
- supported-format definitions, upload limits, parser exports, worker/result
  contracts, CLI and scraper help/configuration, and user-visible diagnostics;
- source comments and regeneration/runtime contracts throughout `apps/`,
  `packages/`, `tools/`, and `scripts/`; and
- the complete tracked review/plan history, with Cycle 16 and current Cycle 17
  candidates checked separately for ownership.

Repeated authored/generated data was checked at its schema, generator,
projection, and consumer boundaries. It was not treated as 683 independent
prose documents.

## Findings

None. No candidate was both actionable at the reviewed revision and genuinely
new relative to tracked history.

## Code/document truth result

- The public catalog section reports 683 authored cards, 551
  optimizer-executable cards, and 24 issuers. Its 24 table rows sum to the
  same totals. The authored tree contains 683 YAML card files, generated
  summary/full catalogs report 683 cards and 24 issuers, and the optimizer
  artifact contains 551 cards with at least one supported reward.
- Every issuer README has one generated index. A read-only exhaustive link
  comparison found 683 generated YAML links, zero missing links, zero extra
  links, and zero issuer-directory mismatches.
- README technology claims agree with the manifests and workflow: Astro 7,
  Svelte 5, Tailwind CSS 4, TypeScript 5.9, and Bun 1.3.12. Root commands,
  the separate Playwright step, frozen install, static Pages output, and
  browser-local default analysis agree with executable configuration.
- Supported file extensions agree across README prose, the shared web format
  registry, browser entry points, and server/CLI routes. Remote PDF fallback
  remains opt-in and consented; scraper issuer/model/output-review instructions
  agree with the current constants and CLI behavior.
- The validated YAML examples retain the current required reward identity,
  support, stacking, cap, performance-tier, and global-constraint fields.
  Regeneration comments consistently direct maintainers to
  `bun run data:build`.
- Generated publication hashes agree across summary, optimizer, category, and
  issuer-detail projections. Generated documentation is clearly marker-owned,
  while hand-written issuer prose stays outside those markers.
- Workflow permission, action pin, Pages artifact, toolchain, verification,
  and browser-regression descriptions agree with the single deployment
  workflow. No documentation claims that `bun run verify` alone includes the
  separate E2E step.

## Historical reconciliation and candidate decisions

| Candidate | Decision |
| --- | --- |
| README lists XLS/XLSX and HTML without disclosing the new decoded worksheet limits | Not new. Cycle 16 `C16-DOC-001` explicitly required a short README note beside the supported-format claim. Plan 143 implemented the parser limits but omitted that documentation task, so the remaining prose gap stays owned by Cycle 16 rather than becoming a Cycle 17 finding. |
| Category labels can cross into generated TypeScript without structured serialization | Retained by the current Cycle 17 security review as `C17-SEC-001`. The maintainer documentation does not create a separate root; its authoring guidance is one consumer of the same generator boundary. |
| Legacy generated reward indexes rank heterogeneous units | Retained by the current Cycle 17 code review as `C17-CR-001`. The generated JSON contract is the same code-owned root, not a separate prose defect. |
| Root lock metadata says `cardpick` while the private root manifest says `cherrypicker` | Historical and previously rejected by Cycle 12 through Cycle 14 dependency reviews because it changes no installed identity, task, integrity, filter, or runtime behavior. |
| `.claude/CLAUDE.md` calls shared packages “Pure TypeScript” while rules/viz have server entry points | Not a contradiction. The phrase describes their implementation language; only `packages/core` is separately claimed to have no runtime-specific API, and current core source satisfies that narrower contract. |

General earlier coverage statements were not used as duplicate ownership.
Each rejected item above was matched to an exact prior finding, explicit
adjudication, or current sibling finding.

## Final missed-file sweep

The closing pass revisited all current Markdown, generated-document markers,
manifest scripts, compiler/build/test configuration, workflow steps, package
exports, public format and catalog claims, regeneration comments, error
contracts, generated projection identities, and current Cycle 16 repair
files. It also searched for retired product names, stale version/command
claims, manual issuer totals or freshness dates, unsupported regeneration
commands, and unowned TODO/deprecation text.

No full repository gate, browser run, server, deployment, or external research
was performed. The protected untracked Cycle 42 artifacts were not opened,
modified, staged, or adopted.

Final count: **0 genuinely new documentation findings**.
