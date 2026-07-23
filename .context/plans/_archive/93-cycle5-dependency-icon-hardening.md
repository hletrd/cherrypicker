# Plan 93 — Cycle 5 Dependency and Icon Hardening

**Findings:** C5-012, C5-016
**Status:** complete
**Deploy mode:** none

## Outcome

Dense screens reuse one immutable icon table, the locked dependency graph has
no unreviewed High or Moderate advisory, and CI deterministically blocks future
known-vulnerable lock graphs.

## Implementation

1. Move the immutable icon lookup table to Svelte module scope or a dedicated
   typed module without changing rendered SVG behavior.
2. Upgrade compatible direct dependencies and regenerate the lockfile until
   reviewed High and Moderate advisories are eliminated. Prefer removing Low
   advisories as well. Update the pinned Bun toolchain consistently if its
   current pin cannot execute the selected scanner.
3. Add a deterministic lockfile advisory command to the root verification
   flow and CI after frozen install. Exceptions, if unavoidable, must be exact
   advisory IDs with dependency path, reachability rationale, owner, and
   expiry; blanket severity ignores are forbidden.
4. Revalidate development-server defaults, static Astro output, scraper HTTP,
   PDF input, and existing dependency-integrity/vendor-digest controls.

## Tests and evidence

- Icon rendering/type tests and compiler or module-scope inspection.
- Frozen install, dependency integrity, advisory scan, package version listing,
  lint, typecheck, unit, Vitest, build, and E2E.
- `bun audit --json` (or the pinned deterministic equivalent) retained as
  machine-readable closure evidence.

## Acceptance

- [x] Icon instances no longer allocate the complete path map.
- [x] The lock graph has zero unreviewed High/Moderate advisories.
- [x] The advisory scan is part of local verification and CI.
- [x] Toolchain pins and workflow setup remain identical.
- [x] Static output and current runtime boundaries still pass all gates.

## Evidence

- `Icon` now reads one immutable module-scope path map; its rendering and web
  tests pass.
- The dependency graph was upgraded with exact overrides; frozen install and
  dependency-integrity checks pass, and `bun audit --json` reports zero
  advisories.
- Bun 1.3.12 is pinned consistently in package metadata, workflow setup, and
  documentation; the advisory scan runs in root verification and CI.
- Astro 7/Vite 8 static output passed the production build and bundle-budget
  check: 16 initial chunks, 131.9 KiB decoded and 49.0 KiB gzip.
