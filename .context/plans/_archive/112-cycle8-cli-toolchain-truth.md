# Plan 112 — Cycle 8 CLI Help and Bun Verification Truth

**Findings:** C8-010 (Low/High), C8-011 (Medium/High)
**Status:** archived (completed)
**Deploy mode:** none

## Evidence

- Root help advertises `cherrypicker optimize statement.csv --cards ./rules/`,
  while optimize/report reject either authoring override unless both
  `--categories` and `--cards` are present.
- README names Bun 1.3.12 as the sole prerequisite, and the toolchain checker
  validates only Bun, but `bun run verify` shells out to external `npm` for
  lint and typecheck.

## Outcome

Every copyable CLI example satisfies the authoritative option parser, and the
documented Bun-only workstation can run the same verification gate as CI.

## Implementation

1. Replace the impossible root optimize example with either default compiled
   mode or a fully paired authoring example. Generate or contract-test root
   examples against the same option specification used by subcommands.
2. Change `verify` to invoke the existing `bun run lint` and
   `bun run typecheck` scripts. Keep the dependency/security/data/build order
   and avoid recursive workspace invocation.
3. Extend workflow/toolchain consistency tests to reject undeclared
   `npm`/`node` wrappers in the Bun-only verification path and require the
   workflow, README, package manager pin, and root scripts to share the same
   contract.
4. Remove stale internal Node-only wording where it describes the active web
   build rather than a library implementation detail.

## Tests

- Parse every root help example and assert it reaches a valid command-option
  state; explicitly cover default optimize and paired authoring overrides.
- A constrained-PATH or static command-contract test proves `bun run verify`
  does not invoke npm/node wrappers.
- Workflow consistency keeps Bun 1.3.12 pinned before install and executes the
  same root gate used by contributors.

## Acceptance

- [x] Every root help example is executable under its advertised contract.
- [x] `bun run verify` requires only the documented Bun toolchain.
- [x] CI and contributor verification commands cannot drift silently.

## Completion evidence

- Root help is generated from an exported contract and every copyable command
  is parsed through its authoritative command/options boundary.
- Root verification invokes Bun lint/typecheck scripts directly; README,
  workflow, package-manager pin, and consistency checks share that contract.
- Focused CLI/document/toolchain verification passed with the scraper lane's
  211 tests; final script tests passed 69/69 and CLI tests passed 96/96.

## Execution note

`ralph` is unavailable. Prompt 3 will use a command-matrix loop and
documentation/workflow truth assertions.
