# Plan 87 - Cycle 4 CLI, Scraper, and Documentation Boundaries

**Findings:** C4-014, C4-015, C4-016, C4-017
**Status:** completed
**Archived:** 2026-07-23 during Cycle 5 planning
**Deploy mode:** none

## Outcome

Apply one strict scrape-option contract at both process boundaries, sanitize
every inherited terminal sink, reject null-byte paths, and make live
documentation describe the current implementation.

## Tasks

- [x] Reuse the repository terminal sanitizer for every dynamic scraper
  console/error field, including extracted names, issuer/host/URL/path values,
  saved paths, validation diagnostics, and top-level caught errors. Add the
  smallest direct workspace dependency needed for that shared implementation
  and update the lockfile through Bun.
- [x] Add captured real-sink and subprocess tests for OSC-8, OSC-52, CSI,
  CR/LF, C0/C1 controls, and bidi controls through both successful extraction
  output and validation failures.
- [x] Define one scrape option specification/parser/help contract consumed by
  the root wrapper and direct scraper. Only `--allow-host` may repeat. Reject
  duplicate issuer, URL, output, force, and help aliases, plus unknown,
  positional, incomplete, and missing-value arguments before any
  spawn/network/write.
- [x] Make `cherrypicker scrape --help` and `-h` side-effect free, successful,
  and complete. Generate root and direct help from the shared specification and
  prove no child process starts for help or invalid input.
- [x] Make `validateFilePath` reject `\0` immediately and update the current
  test that expects stripping. Verify callers never receive or use a modified
  surrogate path.
- [x] Update README and maintainer documentation to name the custom parser and
  Svelte/SVG chart implementation, use stable catalog wording such as
  "수천 개 키워드", and describe explicit `keyword-overrides.ts` conflict
  resolution. Remove the stale silent-shadowing test comment.
- [x] Run dependency-policy, docs, CLI, scraper, rule, type, and build checks.

## Acceptance

- [x] No attacker-controlled terminal control or bidi sequence survives any
  direct scraper or inherited-root sink.
- [x] Root and direct scraper accept the same valid argument matrix and reject
  the same invalid singleton duplicates. Repeated `--allow-host` preserves
  order.
- [x] Help exits zero, prints complete usage/defaults, and performs no spawn,
  network request, or write.
- [x] Any path containing a null byte fails before filesystem access.
- [x] README, `.claude/CLAUDE.md`, `.claude/AGENTS.md`, and categorizer test
  comments match current dependencies and conflict behavior.
- [x] Manifest, lockfile, dependency, docs, lint, type, build, and focused test
  gates pass.

## Verification progress

- Focused scraper, CLI, terminal, and null-path tests: 48 passed, 0 failed.
- Root process help/no-spawn and malformed/no-spawn tests: 2 passed, 0 failed.
- Categorizer conflict and shared terminal-sink tests: 46 passed, 0 failed.
- CLI and scraper typechecks and builds passed with zero diagnostics.
- Rules typecheck, dependency policy, documentation check, lockfile update, and
  scoped whitespace checks passed.
- The Plan 84 catalog rebuild completed with 683 cards across 24 issuers.
  Final rules tests passed 93/93, scraper tests passed 64/64, CLI tests passed
  79/79, and the dependency, docs, lint, type, build, Bun, and Vitest root gates
  all passed.
- The full browser gate passed with repository-owned cleanup. No deployment
  was performed.

## Coverage

| Finding | Required evidence |
|---|---|
| C4-014 | shared sanitizer at all scraper sinks plus control-sequence tests |
| C4-015 | shared strict scrape spec, generated help, and no-spawn command tests |
| C4-016 | immediate null-byte rejection and caller regression |
| C4-017 | dependency, keyword-count, and conflict-semantics documentation update |

## Expected implementation surface

- `tools/scraper/src/args.ts`, `cli.ts`, and scraper tests
- `tools/scraper/package.json`
- `tools/cli/src/commands/scrape.ts`, option/help boundaries, validation, and
  command tests
- root lockfile updated by the package manager
- `README.md`, `.claude/CLAUDE.md`, `.claude/AGENTS.md`
- `packages/core/__tests__/categorizer.test.ts`
- this plan for completion evidence

No parser worker, optimizer, card layout, browser run, deploy, commit, or push
work belongs to this plan.
