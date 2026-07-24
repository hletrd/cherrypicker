# Cycle 19 dependency expert review

## Result

No genuinely new dependency finding was retained at
`fcc89801451d1c1a31bb9881d213e117fc4ca923`.

- Novel dependency findings: **0**
- Confidence: **High**
- Review mode: manifest, lock, import, configuration, vendor, test, and
  history inspection plus focused non-mutating gates

## Complete dependency inventory

The review reconciled all eight manifests, all eight lock workspace records,
567 lock package rows, every package export map, all production/test/config
source families, root task/test configuration, the deployment workflow, and
the vendored SheetJS archive/checksum.

Source files in the checker-owned workspace families:

| Workspace | Production/test files |
| --- | ---: |
| `apps/web` | 136 |
| `packages/core` | 45 |
| `packages/parser` | 60 |
| `packages/rules` | 21 |
| `packages/viz` | 11 |
| `tools/cli` | 26 |
| `tools/scraper` | 23 |

The 13 declared workspace edges remain `workspace:*` and acyclic:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

Root owns the repository runners/toolchain; runtime packages own their direct
external imports; tests/config may use direct development ownership. Exported
subpaths used by consumers remain declared in
`packages/core/package.json:7-13`,
`packages/parser/package.json:7-13`,
`packages/rules/package.json:7-11`, and
`tools/scraper/package.json:6-8`.

## Cycle 18 `.mts` / `.cts` verification

The repair is coherent across discovery, classification, diagnostics, and
fixtures:

- The shared admitted set now includes both extensions
  (`scripts/check-dependencies.ts:11-22`).
- Recursive production/test discovery and top-level workspace configuration
  discovery use that same set
  (`scripts/check-dependencies.ts:465-510,639-658`).
- `isConfigSourceFile()` derives admission from an allowed extension plus
  exact `config` or `*.config` stem, eliminating the unreachable duplicate
  grammar (`scripts/check-dependencies.ts:493-510`).
- Both extensions enter the TypeScript AST import collector and preserve
  static import/export, import-type, import-equals, `require()`, and dynamic
  import handling (`scripts/check-dependencies.ts:532-603`).
- Production still accepts runtime ownership only; test/config accepts runtime
  or direct development ownership; the only root-runner exception remains
  named `vitest` (`scripts/check-dependencies.ts:605-692`).
- Table-driven fixtures cover undeclared and directly owned production,
  nested-test, and config imports for both extensions
  (`scripts/__tests__/check-dependencies.test.ts:241-296`).

The tracked baseline currently contains zero `.mts`/`.cts` files, so the change
adds preventive admission without changing manifests or `bun.lock`.

## Lock, manifest, and supply-chain checks

- All current workspace imports resolve to declared owners; the standalone
  dependency gate reports no violation.
- The lock has no peer mismatch under the repository's nearest-resolution
  policy (`scripts/check-dependencies.ts:171-437`).
- No manifest or lock dependency uses an unauthenticated remote URL
  (`scripts/check-dependencies.ts:741-773`).
- Both XLSX consumers reference the vendored archive, whose SHA-256 and
  SHA-512 match the pinned values and sidecar
  (`scripts/check-dependencies.ts:24-42,702-797`).
- `bun audit --json` returned an empty advisory object on the review host.
- Cycle 18 added no manifest, lock, package identity, runtime capability, or
  external source.

## Finding classification and history

Confirmed dependency failures: **0**. Likely dependency failures: **0**.
Manual-only dependency risks promoted: **0**.

The current lower-bound persistence exception reported by the debugger and
verifier changes no import, package, runtime compatibility, or toolchain
contract and is not duplicated here. Historical items such as the private
root lock label, the unused internal `viz -> rules` edge, root-runner policy,
optional peer handling, and remote dependency authentication remain owned by
their prior dispositions.

## Verification and missed-file sweep

- The focused checker suite passed all 23 tests, including all four
  module-TypeScript table cases.
- `bun run dependencies:check` passed.
- Core and web typechecks passed.
- The broader 77-test Cycle 18 focused matrix passed with 185 expectations.
- Six Cycle 18 commits have good signatures and branch/origin parity is exact.

The final sweep rechecked every manifest against current production,
test/config consumers; all workspace aliases and export subpaths; root
configuration ownership; peer ranges and resolution paths; remote locators;
vendor digests; toolchain versions; and changed dependency-policy lines. No
unowned current import, incompatible peer, unauthenticated source, duplicate
runtime identity, or new dependency root remained. No deployment was
performed, and the protected untracked Cycle 42 paths were not modified.
