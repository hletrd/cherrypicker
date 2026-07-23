# Plan 81 — Cycle 3 CLI and Standalone Report Integrity

**Findings:** C3-015, C3-016, C3-017, C3-018, C3-019, C3-020, C3-021
**Deploy mode:** none
**Status:** completed

## Outcome

Make a saved report retain the qualifications needed to interpret its numbers,
render all dynamic text through safe single-pass boundaries, write output
without following symlinks, and make CLI help and argument acceptance agree.

## Tasks

- [x] Define a typed standalone-report context carrying latest/full statement
  periods and counts, parser/calendar exclusions, previous-spending basis, and
  deduplicated unsupported calculation issues. Build it in `runReport` and
  render a prominent “분석 범위와 제한” section in the durable HTML.
- [x] Delete numeric-entity pre-decoding. Escape the original string exactly
  once and add invalid/oversized decimal and hex, surrogate, incomplete, and
  script-shaped entity tests across every dynamic report field.
- [x] Replace chained placeholder mutation with one pass over the original
  template using an exact expected-placeholder map. Validate that every
  placeholder occurs exactly once and reject unknown/missing template tokens;
  user text matching a placeholder must remain text.
- [x] Export one terminal text sanitizer from the visualization boundary and
  apply it to every public terminal table/cell, cap/alternative row, and CLI
  optimization disclosure. Keep CLI parser/path diagnostics on the same
  implementation rather than a copy.
- [x] Add real-sink tests for OSC-8/52, CSI, CR/LF, C1, and bidi controls while
  allowing only the table library’s own formatting.
- [x] Add a report-output writer that rejects existing/dangling symlinks and
  non-regular destinations. Default to exclusive create; require an explicit
  overwrite flag for regular files and implement overwrite with a same-directory
  atomic replacement that never follows the final component.
- [x] Give analyze/optimize/report one strict option specification used for
  parsing and help. Handle command `--help` before file validation, document all
  defaults/assumptions, require values, validate bank IDs, and reject unknown,
  stray, duplicate, or incomplete arguments.
- [x] Add command-level stdout/exit and output-safety tests so option parsing,
  usage text, and report behavior cannot drift.

## Acceptance

- [x] A shared HTML report independently discloses every limitation previously
  visible only in the terminal.
- [x] Invalid entities never throw, and placeholder-shaped user strings cannot
  add, remove, or replace report sections.
- [x] No untrusted catalog/taxonomy control sequence survives a terminal sink.
- [x] A report command cannot alter a symlink target; normal overwrite requires
  an explicit flag and remains atomic.
- [x] Every subcommand has side-effect-free complete help, and mistyped options
  fail before parsing or writing.
- [x] Viz and CLI unit/integration tests, lint, typecheck, and build pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C3-015 | `report-context.ts`, durable generator/template section, and report/context subprocess assertions |
| C3-016 | direct escaping plus invalid/oversized decimal/hex, surrogate, incomplete, and script-shaped entity matrix |
| C3-017 | exact seven-placeholder one-pass renderer with missing/duplicate/unknown and user-collision regressions |
| C3-018 | viz-owned sanitizer applied to tables, detail rows, disclosures, and captured real sinks |
| C3-019 | exclusive `O_NOFOLLOW` creation, same-directory atomic replacement, deterministic swap-race, symlink, dangling-link, and command tests |
| C3-020 | analyze/optimize/report help generated from the shared option specification and subprocess stdout/exit assertions |
| C3-021 | exact 24-bank, unknown/unsupported, stray, duplicate, missing-value, and invalid-value parser matrix |

## Verification

- `bun run test` in `packages/viz`
- `bun run test` in `tools/cli`
- `bun run lint`, `bun run typecheck`, and `bun run build` in both packages
- `git diff --check -- packages/viz tools/cli .context/plans/81-cycle3-cli-report-integrity.md`

All commands passed. No browser, E2E, deploy, commit, push, catalog publication,
rule-data, manifest, or lockfile operation was performed.
