# Plan 147: Cycle 17 Test Dependency Ownership

**Finding:** C17-004 (Low/High)
**Status:** completed
**Deploy mode:** none

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
