# Review-plan-fix Cycle 14 — dependency expert

## Revision lock and disposition

- Date: 2026-07-24
- Reviewed revision:
  `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **pass — 0 genuinely new dependency findings**
- Aggregate: **0 reportable findings; High confidence**
- Scope: all root/workspace manifests, the complete Bun lock graph, direct
  ranges and overrides, workspace/package import and export contracts,
  duplicate-version pressure, peer resolution, current advisories, install
  hooks, vendored SheetJS provenance, and the exact Cycle 13 dependency repair
- Exclusions honored: no manifest, lockfile, dependency, source, test,
  configuration, generated artifact, installation, update, browser, server,
  E2E, deployment, staging, commit, or push change; this report is the only
  path written by this role

## Dependency inventory

The repository has one private root and seven private workspaces. The manifests
declare 22 unique external package names and 13 local workspace edges.

| Manifest | Production externals | Workspace dependencies | Development externals | Public entry surface |
| --- | ---: | ---: | ---: | --- |
| root `cherrypicker` | 0 | 0 | 6 | scripts only |
| `@cherrypicker/web` | 6 | 3 | 4 | private app |
| `@cherrypicker/core` | 0 | 1 | 2 | root plus 4 exported subpaths |
| `@cherrypicker/parser` | 4 | 0 | 3 | root plus 4 exported subpaths |
| `@cherrypicker/rules` | 2 | 0 | 2 | root plus 2 exported subpaths |
| `@cherrypicker/viz` | 1 | 2 | 2 | root `main` |
| `@cherrypicker/cli` | 0 | 5 | 2 | `cherrypicker` bin |
| `@cherrypicker/scraper` | 5 | 2 | 2 | `./args` export |

All 13 declared workspace ranges are `workspace:*`. The declared graph is
acyclic:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

An independent source scan found 19 distinct `@cherrypicker/*` specifiers and
12 directly consumed workspace edges, with no missing target, unexported
subpath, undeclared production import, or cycle. The difference from the 13
manifest edges is `viz -> rules`: that private-workspace declaration has no
current direct source import. It dates to the initial scaffold
`0000000a9d9`, was present throughout the Cycle 3 unused-dependency cleanup and
the explicit Cycle 12/13 dependency inventories, adds no external resolution
or second runtime copy, and has no Cycle 14 delta or reproduced failure. It is
historical manifest polish, not a genuinely new dependency root.

Normalized manifest-to-lock comparison found exact name, version, dependency,
development-dependency, peer, optional-dependency, and bin parity for all seven
workspaces. The sole metadata difference is the long-standing private root
label discussed below.

## Frozen lock and resolution audit

`bun.lock` contains:

- **567 package rows**;
- **559 registry rows**, every one carrying SHA-512 integrity;
- **7 workspace-link rows** and the single authenticated
  `xlsx@../../vendor/xlsx-0.20.3.tgz` row;
- **0 malformed or unauthenticated registry rows**;
- **10 overrides**, each resolving exactly to its declared override version;
  and
- **77 peer contracts across 29 owners**: 16 required and 61 optional.

An independent present/absence scan further divided the optional contracts
into 19 present and 42 absent. All 16 required peers are present, every present
peer satisfies its owning range, and absent optional peers are accepted. The
blocking implementation parses JSONC, preserves scoped package names as atomic
path segments, walks owner-child, ancestor-sibling, then root resolution,
validates registry and workspace identities, and fails closed on malformed
metadata, locators, versions, or ranges
(`scripts/check-dependencies.ts:122-438,695-720`).

Every direct external declaration resolves to a row satisfying its range. The
only shared direct range-width differences are intentional compatible
subsets:

- root tooling requests `yaml ^2.9.0`, while rules and scraper request
  `^2.7.0`; all resolve to `2.9.0`;
- root tooling requests `zod ^4.4.3`, while rules and scraper request
  `^4.3.6`; all resolve to `4.4.3`.

Anthropic SDK, iconv-lite, TypeScript, Node types, the workspace links, and
both SheetJS consumers use identical direct ranges. No direct dependency
selects incompatible majors.

### Duplicate-version pressure

The current graph has 21 names with more than one resolved version:

```text
@emnapi/core, @emnapi/runtime, @types/node, aria-query, chokidar, css-tree,
entities, estree-walker, fsevents, hasown, jiti, jsonc-parser, mdn-data,
picomatch, readdirp, request-light, semver, tinyglobby, undici-types, yaml,
yargs-parser
```

Every duplicate is transitive and path-scoped. The multi-major groups are
explained by incompatible consumers such as Node type generations, HTML
parser entities, CSS-tree/MDN data, file watchers, and their matching
`undici-types`; the remaining patch/minor splits stay within parent ranges and
have no direct manifest drift or runtime collision. This surface is not new:
the pre-repair Cycle 13 graph had 22 duplicate names. The repair introduced
none and removed the extra `@astrojs/internal-helpers` version with the dormant
Markdown subtree. Cycle 12 and Cycle 13 already inspected the same remaining
graph, including the duplicate PostCSS override serialization, without a
concrete resolution, integrity, bundle, or runtime failure.

`bun pm ls` reports all seven workspace links plus the six root direct tools
from the 567-row tree, while `bun pm ls --all` resolves the complete nested
graph successfully.

## Exact Cycle 13 optional-peer repair

Commit `b25b462ec08082d4ce6dc5d3c04ae175c4ed65c0` made the dependency
repair. Relative to Cycle 13 review baseline `3e2d663`:

| Surface | Exact delta |
| --- | --- |
| workspace/root manifests | no change |
| `bun.lock` | 130 lines removed, 0 added |
| package rows | 632 -> 567 |
| row identity delta | 65 removed, 0 added, 0 changed among common rows |
| workspaces / overrides | byte-semantic content unchanged |
| dependency checker | 392 additions, 1 deletion |
| focused tests | 432 additions |

The 65 removed rows are exactly
`@astrojs/markdown-remark@7.2.0` and its now-unreachable legacy
Remark/Rehype/Micromark subtree. Astro remains at `7.1.3` and still declares
the exact optional peer `@astrojs/markdown-remark: 7.2.1`
(`bun.lock:629`), but the unused peer is now absent. That is the intended valid
state: `bun pm why @astrojs/markdown-remark` exits 1 with
`No packages matching ... found in lockfile`.

The current-lock assertion passes, and the pre-repair fixture still reports
the exact `7.2.1` required / `7.2.0` actual witness. Synthetic fixtures cover
compatible and incompatible optional peers, absent optional peers, missing and
incompatible required peers, exact/caret/OR/prerelease ranges, nearest nested
resolution, ancestor siblings, root fallback, unrelated nested packages,
scoped names, workspace peers, malformed JSONC/rows, and unsupported locators
(`scripts/__tests__/check-dependencies.test.ts:69-471`).

This closes `RPF13-DEP-001` / Plan 140 without adding a dormant direct
dependency, changing Astro configuration, or weakening the upstream exact
contract. No new peer-policy bypass reproduced on current HEAD.

## Advisory, lifecycle, and vendored-input result

- `bun audit` queried the current package-manager advisory service and exited
  0 with **`No vulnerabilities found`**.
- `bun pm untrusted` found **0 untrusted dependencies with scripts**.
- No repository manifest declares an install lifecycle hook.
- Both SheetJS consumers use the same local archive. Its SHA-256 is
  `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`;
  its SHA-512 is
  `a0b0eade3c3b01c2ea2961f60210a9553665f267fa5f661178ff8d7a1d12254cd5fc1759623b61f78b46e6da22301d4f3eb62dc4e09f6a850292fb6e1fedc024`.
  Both match the blocking policy, and the SHA-256 sidecar matches.
- The archive contains no absolute or parent-traversal path, no dependencies,
  and no preinstall/install/postinstall/prepare hook.
- Because a local `file:` row is not safely assumed to receive registry-name
  advisory coverage, I also checked the current
  [SheetJS advisory index](https://cdn.sheetjs.com/advisories/). It lists
  [CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533)
  through `0.19.2` and
  [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363)
  through `0.20.1`; vendored `0.20.3` is outside both affected ranges.

Completed `C3-DEP-001`/Plan 80 therefore remains closed. The historical
scraper Zod and shared visualization declaration fixes, removal of seven heavy
unused direct packages, frozen installation policy, action pinning, and
blocking dependency/advisory checks also remain closed.

## Candidate adjudication and historical reconciliation

| Candidate | Severity / confidence / newness | Decision |
| --- | --- | --- |
| Current peer mismatch or resolver bypass | N/A / High / not present | Rejected: 77/77 contracts pass; focused adversarial fixtures pass. |
| Cycle 13 lock repair caused unrelated drift | N/A / High / not present | Rejected: 65 rows removed, 0 added, 0 common rows changed; manifests, workspaces, and overrides are unchanged. |
| Root `cherrypicker` vs lock label `cardpick` | Informational / High / historical | Rejected again. Both strings date to initial commit `0000000a9d9`; Cycle 12 and Cycle 13 explicitly adjudicated the label as generated metadata polish. It changes no installed identity, workspace filter, integrity, task, or runtime behavior. |
| Twenty-one multi-version identities | Informational / High / historical | Rejected as a new root. All are nested/transitive, every direct range resolves, the list contracted rather than expanded in Cycle 13, and no duplicate causes a package/export/runtime conflict. |
| `viz -> rules` declared but not directly imported | Informational / High / historical | Rejected as a new root. Scaffold-era private workspace metadata, already inside prior full inventories, with no external row or reproduced cost/failure. |
| New registry or SheetJS advisory | N/A / High / not present | Rejected: live Bun audit is clean and official SheetJS affected ranges end below `0.20.3`. |
| Prefixed/leading-NUL XLSX reaches ZIP inflation | N/A / High / historical rejected hypothesis | Rejected again for the reason below. |

The immediate deduplication baseline was the Cycle 13 dependency report and
aggregate, supplemented by Cycle 12, Plan 140, Plan 80, the deferred ledger,
the current Cycle 14 security/verifier evidence, blame, and full-history text
searches. No dependency candidate survives as genuinely new.

### Explicit prefixed-XLSX rejection

The prefixed/leading-NUL XLSX hypothesis remains rejected. The shared preflight
admits ZIP metadata only when bytes zero and one are `PK`
(`packages/parser/src/shared/xlsx-archive.ts:118-132`). The current Cycle 14
corrected real-workbook probe began `[0,80,75]`; preflight returned `not-zip`,
direct SheetJS treated the bytes as synthetic text/PRN rather than recovering
the original workbook, and production parsing emitted zero transactions with
a missing-header error. No ZIP entry was inflated.

Authenticated SheetJS bytes, a package locator, or the Cycle 13 optional-peer
repair cannot change that offset-zero dispatch condition. There is no new
dependency, import, version, or dispatch edge supporting this candidate.

## Deterministic verification

| Command / inspection | Result |
| --- | --- |
| `bun --version` | `1.3.12`, matching `packageManager` |
| normalized manifest/lock comparison | only the historical private root label differs |
| read-only lock inventory | 567 rows; 559/559 registry rows have SHA-512; 7 workspace + 1 authenticated vendor row |
| independent direct-range/override scan | 0 unsatisfied declarations; 10/10 overrides exact |
| independent peer scan | 77 contracts, 0 mismatches |
| `bun run dependencies:check` | pass |
| `bun test scripts/__tests__/check-dependencies.test.ts` | **15 pass, 0 fail, 34 expectations** |
| `bun pm ls` / `bun pm ls --all` | complete graph resolves |
| `bun pm why @astrojs/markdown-remark` | expected absence; no matching lock package |
| `bun audit` | no vulnerabilities found |
| `bun pm untrusted` | 0 untrusted dependencies with scripts |
| SheetJS SHA-256/SHA-512 and archive-path scan | both digests match; no unsafe path |
| before/after dependency-role lock hash | unchanged at `9ed52a9625665750c54724b95675a5905dd4a93d370eb959fbd59605f4b198fc` |

No install or lock regeneration was used to obtain these results.

## Protected Cycle 42 proof

The six protected untracked Cycle 42 artifacts remain untracked, unstaged,
uncommitted, and byte-identical:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  .context/reviews/cycle42-security-reviewer.md
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```

All other visible untracked Cycle 14 reports belong to sibling roles and were
not altered.

**Final count: 0 genuinely new dependency findings.**
