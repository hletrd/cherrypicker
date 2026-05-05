# Verifier — Cycle 4 Findings

## Summary
5 findings. 1 critical verification gap, 2 high, 2 medium.

## Findings

### V-VER-01 [CRITICAL] No test catches FileDropzone ReferenceError
- **File**: `apps/web/src/components/upload/FileDropzone.svelte`
- **Issue**: The `errorMessage` vs `errorMessages` bug (C-CR-03) has no test coverage. Component test suite does not exercise error paths.
- **Fix**: Add component tests triggering each error condition.

### V-VER-02 [HIGH] No parity tests between server and web parsers
- **Files**: `packages/parser/src/` vs `apps/web/src/lib/parser/`
- **Issue**: Same input files produce potentially different outputs. No automated comparison.
- **Fix**: Add shared fixture files and cross-reference tests.

### V-VER-03 [HIGH] No tests for refund/negative amount handling
- **Files**: All parser test suites
- **Issue**: No test fixtures include refund transactions. Parser behavior on negative amounts is undefined.
- **Fix**: Add refund fixtures to all parser test suites.

### V-VER-04 [MEDIUM] Gate script runs lint/typecheck/test but not in parallel
- **File**: `package.json` scripts
- **Issue**: `npm run lint && npm run typecheck && bun run test` runs sequentially. Slower than needed.
- **Fix**: Use `concurrently` or npm workspaces parallel execution.

### V-VER-05 [MEDIUM] No mutation testing or property-based tests
- **Files**: Test suites across repo
- **Issue**: All tests are example-based. Edge cases (empty input, max values, unicode) not systematically probed.
- **Fix**: Introduce fast-check or similar for parsers and optimizer.

## Verification Status
- [x] `npm run lint` passes
- [x] `npm run typecheck` passes
- [x] `bun run test` passes
- [ ] Component tests cover error paths (FAIL)
- [ ] Parity tests exist (FAIL)
- [ ] Refund fixtures exist (FAIL)

## Recommendations
1. Add `@playwright/test` component tests for FileDropzone
2. Create `packages/parser/__tests__/parity/` directory with shared fixtures
3. Add property-based tests for `calculateRewards`
