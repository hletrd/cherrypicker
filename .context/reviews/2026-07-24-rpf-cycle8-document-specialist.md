# Cycle 8 document-specialist review

- Review date: 2026-07-24
- Reviewed HEAD: `3fd993d471a8676170031f20715f6a53c99e8a9f`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Review role: document specialist
- Lens: current contributor/operator documentation versus local code,
  configuration, generated data, command help, and deployment behavior
- Findings: 2 (`2 Medium`)

## Inventory and authoritative sources

The whole-repository inventory contained 2,199 tracked paths. I read or
mechanically checked all 29 tracked Markdown files outside `.context`:

- `README.md`, `.claude/AGENTS.md`, and `.claude/CLAUDE.md`;
- all 24 generated issuer catalog READMEs;
- `vendor/README.md`;
- the tracked `.omc` historical plan, which was classified as provenance rather
  than current operating guidance.

The 1,062 tracked `.context` review/plan artifacts were inventoried to avoid
re-reporting fixed history, but were not treated as current instructions. Claims
in current documents were followed through all eight workspace manifests, the
deployment workflow, Bun/toolchain checks, CLI and scraper help/argument
parsers, parser and scraper runtime paths, 683 canonical card YAML files, 24
issuer indexes, the category and issuer registries, and 28 published data
artifacts.

Read-only verification at this snapshot:

- `bun run toolchain:check` passed with Bun 1.3.12.
- `bun run docs:check` and
  `bun scripts/readme-catalog.ts --check` passed for 683 cards across 24
  issuers.
- `bun scripts/check-dependencies.ts` passed.
- `bun run --cwd apps/web build` completed all five static routes.
- The live help output for `analyze`, `optimize`, `report`, and `scrape` was
  compared with their parsers and runtime implementations.

The complete `verify` aggregate was not rerun in this documentation-only pass;
the first finding is a deterministic command/runtime contract mismatch visible
before execution, not an inference from a failed local gate.

## Findings

### C8-DOC-001 — The Bun-only setup still cannot reproduce the authoritative verification gate

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed**
- Documentation location: `README.md:139-155`
- Conflicting runtime sources:
  - `package.json:18-29,55`
  - `scripts/check-toolchain.ts:34-45`
  - `.github/workflows/deploy.yml:24-30,41-42`
  - `.claude/CLAUDE.md:6-8,20-22`

The current README says Bun 1.3.12 is the required tool and its checker verifies
only that Bun version. The repository's authoritative `verify` script,
however, invokes external `npm` for both lint and typecheck. Deployment installs
Node 24 before running that same gate, and the internal architecture guide says
the web application runs/builds on Node.

This is distinct from the fixed Cycle 7 `dev:web` defect: `dev:web` now delegates
through Bun correctly. The remaining mismatch is the repository's principal
verification contract.

Concrete scenario:

1. A contributor provisions the only documented prerequisite, Bun 1.3.12.
2. `bun run toolchain:check`, installation, data generation, and the documented
   web command can all begin successfully.
3. The contributor runs the repository's release-quality `bun run verify`.
4. The gate reaches `npm run lint` and requires an undeclared Node/npm
   installation and version. The documented checker cannot warn about it.

Impact: a README-conformant workstation is not necessarily CI-conformant, and
the CI-only Node 24 setup masks that drift. Contributors cannot tell whether
Node is an intentional supported runtime or an accidental wrapper dependency.

Root fix: choose and enforce one toolchain contract. If verification is meant
to be Bun-only, replace the two `npm run` calls with the already-defined Bun
scripts, prove the web build under Bun, and remove stale Node-only claims/setup.
If Node 24 is intentional, list it beside Bun in the README, pin/check it in
`toolchain:check`, and explain which gates require it. Add a documentation
contract assertion that the prerequisites, checker, workflow, and `verify`
implementation stay aligned.

### C8-DOC-002 — The scraper's documented/help surface omits the credential required by every successful run

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed**
- Documentation/help locations:
  - `README.md:94-105,123-126,225-227`
  - `package.json:30-33`
  - `tools/scraper/src/args.ts:24-74,100-119`
- Authoritative runtime sources:
  - `tools/scraper/src/cli.ts:80-142`
  - `tools/scraper/src/extractor.ts:78-93`
  - `packages/rules/src/security.ts:3-16`

The README presents the scraper as a repository capability and says it uses the
Claude API, but it never names the scraper's required environment variable or
gives an operating sequence. `bun run scrape --help` lists ten supported issuer
IDs, URL/host/output/overwrite options, and runnable examples, yet also omits
the credential and optional model override.

The implementation constructs the Anthropic client for every extraction and
defaults the model from `ANTHROPIC_MODEL`, so a successful scrape requires
`ANTHROPIC_API_KEY`. More importantly, the CLI fetches and cleans the target
page before it reaches the LLM extraction step. There is no credential
preflight before that network work.

Concrete scenario:

1. A contributor discovers the root `scrape` script or follows the help example
   `bun run scrape -- --issuer hyundai`.
2. The command validates the target and downloads the official page.
3. It reaches “LLM으로 혜택 규칙 추출 중” and fails because the undocumented
   `ANTHROPIC_API_KEY` is absent.
4. The user has already performed remote network work and still has no guidance
   on the required variable, supported model override, generated YAML review,
   or subsequent `data:build`/`data:check` steps.

Impact: the only self-described runnable help path for the scraper is
operationally incomplete. This is separate from the already-fixed PDF fallback
documentation, which now correctly names `ANTHROPIC_API_KEY`.

Root fix: add a scraper section that names `ANTHROPIC_API_KEY`, safely explains
secret injection, documents `ANTHROPIC_MODEL`, links the ten supported issuer
IDs to the canonical list, explains host expansion and overwrite risk, and
ends with manual YAML review plus `data:build` and `data:check`. Put the same
credential/model prerequisite in `scrape --help`, and preflight the key before
the page fetch so failure is immediate and side-effect-free. Cover the help and
preflight wording with a command-contract test.

## Cross-file and final missed-defect sweep

The final sweep rechecked every setup/example command, runtime and model
reference, environment-variable mention, generated marker and count, internal
path, issuer range, card-data authoring sequence, hosting/security
qualification, and current-versus-historical instruction boundary. Generated
README content remained source-consistent, and no broken local documentation
link or stale card/issuer total was found.

Fixed history was deliberately excluded: Cycle 7's `dev:web` Node wrapper is
gone, and the PDF remote fallback now documents `ANTHROPIC_API_KEY` and consent.
The current findings concern the still-external `npm` verification gate and the
separate scraper operating path.

Result: **2 current findings**, `C8-DOC-001` and `C8-DOC-002`.
