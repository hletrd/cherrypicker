# Plan 147: Cycle 17 Test Dependency Ownership

**Finding:** C17-004 (Low/High)
**Status:** completed after Cycle 18 preventive completion
**Deploy mode:** none
**Archived:** Cycle 19 planning pass after completion verification

## Evidence

- `apps/web/__tests__/parser-cycle5-integrity.test.ts` directly imports
  `iconv-lite`.
- `apps/web/package.json` does not own that package; the import succeeds
  because `packages/parser` currently provides a reachable transitive runtime
  dependency.
- `scripts/check-dependencies.ts:553-595,695-720` scans production `src`
  imports against production dependencies but does not validate test/config
  imports against development dependencies.
- A clean install or dependency-layout change can therefore break the web
  parity test without a manifest diff in its owning workspace.

## Implementation

1. Add `iconv-lite` to the web workspace's development dependencies at the
   compatible locked range and update the lockfile canonically.
2. Extend the dependency-policy helper to classify production and
   test/config source roots separately.
3. Validate production imports against runtime ownership, and test/config
   imports against the union of runtime and development ownership.
4. Preserve the existing Node builtin, workspace-alias, relative import, and
   approved optional-package handling.
5. Define only narrow, named exemptions for repository-owned root runners
   whose dependencies are intentionally owned by the root manifest; avoid a
   blanket test-directory exemption.
6. Add checker fixtures proving an undeclared test-only package import fails,
   the same import passes when declared as a development dependency, and a
   development-only dependency still fails when imported by production
   source.
7. Run the checker across every workspace and resolve only ownership failures
   demonstrated by the expanded rule.

## Acceptance

- [x] The web parity test owns `iconv-lite` directly as a development
      dependency.
- [x] An undeclared package imported only by a test or config file fails the
      repository dependency check.
- [x] A declared development dependency is accepted for test/config code.
- [x] Production code cannot satisfy ownership through a development-only
      declaration.
- [x] Existing workspace aliases, builtins, and explicit optional-package
      policy remain valid.
- [x] The lockfile records one compatible package identity without unrelated
      churn.

## Completion evidence

The requested `ralph` capability was unavailable, so Prompt 3 used the
approved disciplined manual fallback. The web workspace now owns
`iconv-lite@^0.6.3` as a development dependency, reusing the existing locked
`iconv-lite@0.6.3` identity.

The checker classifies production, test, and top-level config sources.
Production accepts runtime ownership only; test/config sources accept runtime
or development ownership. The sole root-runner exemption is the named
root-owned `vitest` package. Fixture coverage proves undeclared test/config
failure, development ownership success, development-only production failure,
and the narrow exemption. The checker plus web parity matrix passed 62 tests
and 241 expectations, and the standalone dependency policy passed.

## Verification

Run the dependency-policy fixture suite, the repository dependency checker,
and the web parser parity test, then run:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Use the repository E2E ownership preflight and postflight checks. Do not
deploy.

## Cycle 18 reopening — module-TypeScript admission

The completed production-versus-test/config ownership policy is correct for
every tracked source. Its file-admission contract nevertheless has a dormant
gap:

- `scripts/check-dependencies.ts:11-21` recognizes `.mts` and `.cts` config
  names but omits both extensions from `SOURCE_EXTENSIONS`.
- Recursive production/test discovery and top-level config discovery filter
  on that set before import parsing.
- The tracked tree contains no `.mts` or `.cts` source, so this is preventive
  completion under Plan 147 rather than a new current finding.

### Reopened tasks

- [x] Add `.mts` and `.cts` to the shared source-extension inventory.
- [x] Replace the separate config-name grammar with an
      `isConfigSourceFile()` decision derived from the admitted extension and
      a `config` / `*.config` stem.
- [x] Parameterize production, nested-test, and config fixture filenames
      while preserving their current defaults.
- [x] Add exact `.mts` and `.cts` fixtures for all three source kinds,
      undeclared-package rejection, and correct direct ownership acceptance.
- [x] Preserve deterministic diagnostics, the narrow root Vitest exception,
      builtins, relative imports, workspace aliases, vendor integrity, and
      peer checks.
- [x] Avoid manifest or lockfile churn unless the expanded current-tree scan
      demonstrates a real ownership failure.

### Reopened acceptance

- [x] `.mts` and `.cts` production, nested-test, and config files all reach
      import classification.
- [x] Undeclared imports produce exact deterministic diagnostics.
- [x] Runtime ownership satisfies production and runtime/development
      ownership satisfies test/config.
- [x] The current tree remains clean without unrelated manifest or lockfile
      changes.
- [x] The focused policy suite, standalone dependency check, and all required
      repository gates pass.

### Cycle 18 completion evidence

The shared extension set now admits `.mts` and `.cts`. Config admission uses
the same extension set plus a `config` / `*.config` stem instead of an
independent regular expression. The fixture helper accepts explicit
production, nested-test, and config names, and table-driven cases cover both
module-TypeScript extensions across all three source kinds.

The pre-fix cases returned no diagnostics for either extension. After the
repair, the focused policy suite passed 23 tests and 43 expectations,
including exact undeclared diagnostics and direct runtime/development
ownership. The standalone dependency gate passed. The expanded current-tree
scan required no manifest or lockfile change. The signed plan-scoped
implementation commit is `1876350`.

### Cycle 18 implementation protocol

The requested `ralph` capability is unavailable. Prompt 3 will use the
approved disciplined manual plan-to-test fallback: add focused failing
module-extension fixtures, implement the shared discovery contract, run
`bun test scripts/__tests__/check-dependencies.test.ts`, run
`bun run dependencies:check`, then run:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Use the repository E2E ownership preflight and postflight checks. Do not
deploy.
