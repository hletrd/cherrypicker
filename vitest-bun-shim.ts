// Shim for bun:test API — allows package test files to run under vitest.
// Only covers the subset of bun:test used by the packages/* test files.
// Test files that use Bun-specific APIs beyond bun:test (import.meta.dir,
// readFileSync with Bun paths, loadCardRule, etc.) should be excluded from
// the vitest config and only run under `bun test` (C39-01).

export { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, it, suite } from 'vitest';
