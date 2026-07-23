# Cycle 9 code-reviewer review

## Provenance and scope

- Specialist lens: code-reviewer — current logic, contracts, maintainability, and cross-file correctness.
- Review date: 2026-07-24.
- Reviewed commit: `c5c6eab9b421e547d66716e989e08c747cc36aa1`.
- Tracked-manifest fingerprint: SHA-256 `47bfbcc36706291e34da2709db76b134184c2c99fe9c25151cc8ac12de83f0d1` over the sorted `git ls-files` output.
- Active-tree fingerprint after excluding historical `.context/reviews` and `.context/plans` bodies: SHA-256 `593f6630e814f550d7db85b63685c91a3056e0abf7aedce18e82ede9ba5377e8`.
- Historical findings were checked only to avoid duplicate reporting. A previously fixed issue was not carried forward unless the current tree still reproduced it.

## Repository inventory and coverage

The tracked inventory contains 2,232 files. It was classified as 190 source files, 161 tests/specifications/fixtures, 29 current documentation files, 24 configuration/CI files, 725 domain/generated data files, 3 asset/vendor files, 21 other tracked files, and 1,079 historical `.context` plan/review files.

Every active tracked file was included in the inventory. The area-level manifest is:

| Area | Tracked files | Reviewed contents |
| --- | ---: | --- |
| `apps/web` | 166 | 81 source files, 53 tests, 2 configs, 28 generated public JSON artifacts, CSS/icon assets |
| `packages/core` | 38 | 26 source files, 10 tests, 2 configs |
| `packages/parser` | 85 | 35 source files, 48 tests/fixtures, 2 configs |
| `packages/rules` | 733 | 14 source files, 6 tests, 24 issuer READMEs, 6 indexes/configs, all 683 card YAML files |
| `packages/viz` | 14 | 8 source files, 3 tests, 2 configs, report template |
| `tools/cli` | 28 | 16 source files, 10 tests, 2 configs |
| `tools/scraper` | 35 | 12 source files, 11 tests, 10 target configs plus package/TypeScript configs |
| `scripts` | 19 | 11 implementation/migration scripts and 8 tests |
| `e2e` | 16 | runtime helper, specs, fixtures, screenshots, and CSS |
| Root/policy/workflow/vendor/other | 19 | manifests, lockfile, Astro/Playwright/Turbo/TypeScript configuration, CI, policies, README, vendored archives |

The 683 declarative card files and generated catalog shards were checked exhaustively through schema, catalog, publication-drift, and repository verification gates in addition to targeted source inspection. Generated/cache/build directories and `.git` were not treated as authored source.

Verification at the reviewed commit:

- `bun run lint` — passed across every workspace.
- `bun run typecheck` — passed; Astro reported 0 errors, 0 warnings, and 0 hints.
- `bun run test` — passed across all package suites; the root script suite reported 69 passing tests.
- No browser/E2E run was performed by this lens.

## Finding

### C9-CR-01 — Short merchant allowlist aliases match inside unrelated merchant names

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `packages/core/src/calculator/reward.ts:184-195`
  - `packages/core/src/calculator/reward.ts:395-408`
  - `packages/core/src/categorizer/normalize.ts:8-13`
  - `packages/rules/src/schema.ts:190-215`
  - `packages/rules/data/cards/samsung/cu-baemin-taptap.yaml:31-53`

Failure scenario:

The supported Samsung `CU배달의민족 탭탭` rule authors `CU` as a specific merchant. The calculator normalizes the statement merchant and candidate, then performs an unrestricted `String.includes` check. A transaction at `SECURITY SERVICE`, `CULTURE CENTER`, or `CUBAN RESTAURANT` therefore contains the two-letter sequence `cu` and is treated as a CU purchase. Because a matched merchant allowlist deliberately bypasses the rule's category check, the false match applies even when the transaction category is `other`.

Executable evidence:

A targeted calculation loaded the current Samsung card rule, used previous spending of 300,000 won and a 10,000-won `other` transaction, and varied only the merchant. `CU 강남점`, `SECURITY SERVICE`, `CULTURE CENTER`, and `CUBAN RESTAURANT` all returned a 1,000-won reward with no unsupported-rule diagnostic. The first result is intended; the other three are false positives.

Rationale:

This is not limited to one hand-authored card. The schema accepts arbitrary strings without a matching mode or boundary contract, and the catalog contains several short Latin aliases such as `CU`, `KT`, and `SKT`. A general substring operator is useful for longer Korean merchant names, but it is not a valid identity test for short Latin tokens. The category bypass amplifies a text-matching false positive into a financial recommendation error.

Suggested fix:

Define merchant aliases as a typed matching contract rather than bare strings, for example `{ value, mode: exact | token | prefix | contains }`. Require `exact` or Unicode/ASCII token-boundary matching for short Latin aliases, while retaining an explicit `contains` mode only where catalog authors need it. Validate ambiguous short aliases during catalog publication. Add calculator tests covering the intended `CU` variants and unrelated strings containing `cu`, plus equivalent tests for the other short aliases in the catalog.

## Final missed-issue sweep

The final pass rechecked calculator selection and cap paths, optimizer totals, parser ownership and format dispatch, web persistence/store interactions, dashboard/result/report rendering, CLI option/help contracts, scraper fetch/write policy, catalog publication, root scripts, manifests, CI, and test gaps. Previously repaired Cycle 8 findings remained fixed. No additional code-review finding was included without a current executable or direct cross-file failure path.

Findings: 1 total — 1 Medium.
