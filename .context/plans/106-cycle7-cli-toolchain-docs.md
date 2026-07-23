# Plan 106 — Cycle 7 CLI, Toolchain, and Remote-PDF Contract

**Findings:** C7-005 (Medium/High), C7-010 (Medium/High), C7-013 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Optimize/report pass custom categories to a loader that ignores them in
  compiled-catalog mode; independent validation reports 2,515 issues.
- README declares Bun 1.3.12 as the required tool, but root `dev:web` shells
  to `node --run dev`; the Bun gate passes immediately before that command
  fails on a Bun-only host.
- The only remote-PDF example omits required `ANTHROPIC_API_KEY`; its truth
  test checks only that the command string exists.

## Outcome

CLI semantic overrides are always paired, the documented Bun-only development
path is executable, and the opt-in remote PDF path documents and tests its
credential prerequisite without exposing a secret.

## Implementation

1. For optimize/report, reject exactly one of `--categories`/`--cards`.
   Preserve categories-only support for analyze. Pass custom categories to
   `loadCliCardCatalog` only in authoring mode, and make the loader reject any
   unpaired authoring input defensively.
2. Update option help/assumptions and command tests for categories-only,
   cards-only, both overrides, and default compiled mode.
3. Change root `dev:web` to `bun run --cwd apps/web dev`. Extend the workflow
   truth test to derive the pinned Bun contract and require the documented
   root development script not to invoke an undeclared runtime.
4. Add a concise README prerequisite for `ANTHROPIC_API_KEY`, including safe
   shell-local usage and nonlogging guidance. Extend the documentation
   contract and stubbed CLI tests for missing/valid configuration.

## Tests

- Option/parser/command/catalog tests for every override combination.
- A Bun-only PATH probe or script-contract test that starts the workspace
  command far enough to prove no Node shell dependency.
- README truth tests tying `--allow-remote-llm` to the API-key prerequisite;
  stubbed remote client tests with no real network or secret.

## Acceptance

- [x] Optimize/report cannot combine custom categories with compiled cards.
- [x] Both authoring overrides validate as one taxonomy/catalog pair.
- [x] The sole documented Bun prerequisite can start `dev:web`.
- [x] Remote-PDF setup names its required key without committing or printing it.

## Completion evidence

- Optimize/report require paired authoring categories/cards at the option and
  loader boundaries; default compiled mode no longer receives unrelated
  authoring categories.
- `dev:web` now uses Bun directly and its workflow contract rejects a Node
  regression.
- The localized README contract binds the remote command to
  `ANTHROPIC_API_KEY` and nonlogging guidance; existing stubbed LLM tests cover
  missing and well-formed keys without a network request.

## Execution note

`ralph` is unavailable; Prompt 3 uses command-matrix and documentation-contract
tests.
