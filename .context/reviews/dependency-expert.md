# Cycle 3 — Dependency Expert

**Review target:** `614ce5c`
**Lens:** manifest/import correctness, lock reproducibility, workspace isolation, runtime/toolchain compatibility, unused dependency surface, and build-task dependency flow.

## Inventory and method

All eight workspace/root `package.json` files, `bun.lock`, `turbo.json`, the shared and package TypeScript configurations, deploy workflow, package exports, and production/test imports were inventoried. The resolved lock graph was reconciled against direct declarations and repo-wide import searches. Cycle 1/2 dependency closures (frozen install, action pinning, toolchain check, statement parser entry, and deterministic catalog validation) remain in place.

## Findings

### C3-DEP-001 — The SheetJS tarball is locked by URL without an integrity digest

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/package.json:29`; `packages/parser/package.json:22`; `bun.lock:1380`
- **Concrete failure scenario:** The bytes served for `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` are replaced or corrupted while the URL remains unchanged. A clean CI/developer install can accept those new bytes even with `--frozen-lockfile`, because the lock entry records the URL and executable mapping but no `sha512` integrity value.
- **Evidence:** Both runtime packages depend directly on the same HTTPS tarball. Normal registry entries in `bun.lock` carry a final `sha512-…` field; the `xlsx` entry is `["xlsx@https://…tgz", {"bin": …}]` with no digest. Frozen resolution prevents a version-selection change, not content substitution at an unverified mutable URL.
- **Suggested fix:** Consume an immutable, checksummed source: a registry artifact whose lock entry includes integrity, a commit-pinned source with verified archive hash, or a vendored tarball whose SHA-256/SHA-512 is checked before install. Add a lock-policy gate that rejects non-workspace remote package entries without a content digest.

### C3-DEP-002 — The scraper imports Zod directly without declaring it

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `tools/scraper/src/rule-contract.ts:1-9`; `tools/scraper/__tests__/schema-contract.test.ts:2`; `tools/scraper/package.json:12-22`
- **Concrete failure scenario:** The scraper workspace is installed, packed, or typechecked under an isolated/strict workspace linker. Its direct `import { z } from 'zod'` cannot be resolved because the package declares only rules, Anthropic, Cheerio, iconv-lite, and YAML; today it succeeds through root/transitive hoisting.
- **Evidence:** Production source and a contract test import `zod` directly. `@cherrypicker/scraper` has no `zod` entry in dependencies or devDependencies, while the root happens to declare Zod and `@cherrypicker/rules` also brings it transitively. Relying on either violates the workspace’s manifest boundary.
- **Suggested fix:** Add a direct compatible `zod` dependency to `tools/scraper/package.json`. Add an isolated-workspace resolution/build check (or a dependency-boundary linter) so every non-relative production import must be declared by its owning workspace.

### C3-DEP-003 — Seven heavy direct dependencies have no production consumer

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/package.json:20,22-26`; `packages/parser/package.json:23`
- **Concrete failure scenario:** Every clean install and dependency update carries unused packages and their transitive supply-chain/update surface even though they cannot affect the built product. LayerChart also retains a broad D3 graph that obscures which visualization dependencies are actually required.
- **Evidence:** Repo-wide production-source searches found no imports of the web workspace’s `@cherrypicker/viz`, `d3-array`, `d3-scale`, `d3-shape`, `layerchart`, or `papaparse`. The parser has no source import of `unpdf`; its only mentions are boundary tests asserting that it is not loaded. The direct installed footprints alone are roughly 1.1 MiB for LayerChart, 0.63 MiB across the three listed D3 packages, and 0.27 MiB for Papa Parse, before transitive duplication.
- **Suggested fix:** Remove the unused declarations and regenerate the lockfile. If any are intentional near-term experiments, move that work to a separate branch/package rather than retaining dormant production dependencies. Add an import-aware unused-dependency check with explicit exemptions for CLI/config-only packages.

## Compatibility and missed-issue sweep

- The current lock resolves TypeScript 5.9, Zod 4, Astro 6, Svelte 5, and the expected workspace links; no duplicate incompatible Zod major was found.
- `@types/bun` currently resolves to 1.3.12 while the runtime is pinned to Bun 1.2.6. No web source path using a 1.3-only Bun API was found, so this was recorded as maintenance drift rather than promoted to a separate defect.
- Package exports, task dependencies, frozen-install workflow, Node 24 action runtime, and parser/server dependency isolation were rechecked. No additional dependency issue met the evidence threshold.
