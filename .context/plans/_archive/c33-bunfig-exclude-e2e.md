# Plan: C33-01 — Exclude Playwright E2E spec files from bun test

**Status:** DONE
**Finding:** C33-01 (MEDIUM, High confidence)
**Files:** `e2e/*.spec.js`, missing `bunfig.toml`

## Problem

The `e2e/` directory contains 4 Playwright `.spec.js` files that are discovered by `bun test` (which matches `.spec.` filenames). `bun test` attempts to run them but crashes because Playwright's `test.describe.configure()` and `test.beforeAll()` APIs are not compatible with Bun's test runner. Running `bun test` from the repo root produces 4 errors and 4 failures. The repo has no `bunfig.toml` to exclude the `e2e/` directory.

The `package.json` `test:bun` script works around this by restricting to `packages/parser tools/scraper`, but bare `bun test` still fails. The `verify` script runs `bun run test` which invokes `turbo run test`, but any developer running bare `bun test` will see failures.

## Implementation

### Step 1: Create bunfig.toml at repo root

Create `bunfig.toml` with:

```toml
[test]
exclude = ["e2e"]
```

This tells `bun test` to skip the `e2e/` directory when discovering test files.

### Step 2: Verify bun test passes

Run `bun test` from the repo root. It should now:
- Discover and run all `.test.ts` files
- Skip all `.spec.js` files in `e2e/`
- Report 0 failures

### Step 3: Verify E2E tests still work via playwright

Run `bun run test:e2e` to confirm Playwright tests are unaffected.

## Verification

- `bun test` from repo root should pass with 0 errors and 0 failures
- `bun run test:e2e` should still work (no regression)
