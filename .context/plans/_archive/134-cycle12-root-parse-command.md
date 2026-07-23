# Plan 134 — Cycle 12 Root Parse Command

**Finding:** C12-006 (`RPF12-DOC-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Root `parse` executes `packages/parser/src/index.ts`, an export-only barrel.
- It ignores arguments, prints no result, and exits zero for a nonexistent
  statement.
- The actual user-facing parse flow is the CLI `analyze` command.

## Outcome

The root parse shortcut invokes a real supported command, reports invalid input
with a nonzero exit, and provides useful help rather than a false success.

## Implementation

1. Add a red process/manifest test proving `bun run parse -- <missing>` cannot
   exit zero and that help reaches the real CLI.
2. Point the root script at `tools/cli/src/index.ts analyze` or remove the
   misleading alias if a supported equivalent cannot be preserved.
3. Update any command documentation or workflow-contract assertions that
   reference the shortcut.
4. Re-run CLI help, argument validation, local-first parsing, and root script
   tests.

## Acceptance

- [x] The root command executes supported parser behavior.
- [x] Missing/nonexistent input returns a nonzero diagnostic.
- [x] Help text describes actual arguments and privacy behavior.
- [x] Existing direct CLI commands remain unchanged.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual process-test fallback followed by all repository gates. No deployment
is permitted.

## Completion evidence

- Red: process-contract coverage reproduced zero-exit/no-output behavior for a
  nonexistent statement.
- Green: the root script now routes to CLI `analyze`; CLI process and full
  command suites pass with real help and nonzero invalid-input behavior.
- Commit:
  `087f2e5dfc209ac2407dec0c1d77a8b988569f51`
  (`🐛 fix(cli): route root parse to analyze`).
