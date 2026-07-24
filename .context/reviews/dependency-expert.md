# Cycle 19 dependency expert review

Date: 2026-07-24
Baseline: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
Full provenance:
`.context/reviews/2026-07-24-cycle19-dependency-expert.md`

## Result

**0 genuinely new dependency findings.** Confidence: High.

## Inventory

The review reconciled all eight manifests, eight lock workspace records, 567
lock package rows, all package exports, production/test/config import families,
root task/test configuration, the workflow, and vendored SheetJS
archive/checksum. Checker-owned source counts were 136 web, 45 core, 60 parser,
21 rules, 11 viz, 26 CLI, and 23 scraper files.

The 13 `workspace:*` edges remain acyclic:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

## Cycle 18 verification

- `.mts` and `.cts` are in the shared extension set
  (`scripts/check-dependencies.ts:11-22`).
- Production/test recursion and config discovery use that set; config stems are
  exact `config` or `*.config`
  (`scripts/check-dependencies.ts:465-510,639-658`).
- Both extensions reach the TypeScript AST import collector
  (`scripts/check-dependencies.ts:532-603`).
- Production accepts runtime ownership only; test/config also accepts direct
  development ownership; the named root-runner exception remains only
  `vitest` (`scripts/check-dependencies.ts:605-692`).
- Undeclared and owned production, nested-test, and config fixtures cover both
  extensions (`scripts/__tests__/check-dependencies.test.ts:241-296`).

The current tracked tree contains zero `.mts`/`.cts` paths, and the preventive
repair caused no manifest or lock churn.

## Current graph evidence

`dependencies:check` passes with no unowned import, peer mismatch, remote
locator, vendor digest/reference mismatch, or export-boundary issue.
`bun audit --json` returns an empty advisory object. Both XLSX consumers retain
the pinned vendored identity and expected SHA-256/SHA-512
(`scripts/check-dependencies.ts:24-42,702-797`).

The lower-bound persistence exception reported by the debugger/verifier changes
no import, package, runtime compatibility, or toolchain contract and is not
duplicated here.

Focused dependency tests, the combined dependency gate, core/web typechecks,
and the broader 77-test/185-expectation Cycle 18 matrix passed. All six Cycle
18 commits have good signatures and remote parity is exact.

Confirmed dependency findings: **0**; likely: **0**; manual-only promoted:
**0**. No deployment was performed.
