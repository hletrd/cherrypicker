# Cycle 7 document-specialist review

Review snapshot: `3086a379e31e5b17f82401807f5b3c24325b9962` on 2026-07-24.

## Inventory and verification

The documentation inventory covered all 29 tracked Markdown files outside `.context`:

- The root `README.md`.
- `.claude/AGENTS.md` and `.claude/CLAUDE.md`.
- All 24 issuer catalog READMEs.
- The vendored spreadsheet README.
- The tracked `.omc` historical implementation plan.

The 1,045 tracked `.context` provenance artifacts were inventoried but treated as historical review/plan records rather than current product instructions. The audit also followed documentation claims into the root/workspace manifests, deployment workflow, CLI/parser source, 683 canonical card YAML files, issuer/category registries, generated rule JSON, 28 public data outputs, and the README generator/checker.

Every current operating document was read or mechanically checked in full. Generated issuer sections, card counts, file links, generator markers, canonical examples, runtime versions, and documented commands were checked across their sources. `bun run data:check` passed, reproducing 683 cards across 24 issuers and verifying all generated README and JSON outputs. Historical plans were checked only for accidental presentation as current user guidance.

## Findings

### C7-DOC-001 — Local setup says Bun is the only required tool, but the documented web command requires Node 24

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Location: `README.md:139-155`
- Authoritative sources: `package.json:10-12`, `.github/workflows/deploy.yml:24-30`, and `.claude/CLAUDE.md:7`

The local-development section says “필수 도구는 Bun 1.3.12예요” and then directs the contributor to run `bun run dev:web`. That script delegates to `node --run dev`; deployment installs Node 24, and the agent guide also identifies Node 24 for the web application. Node is not mentioned anywhere in the README prerequisite.

A new contributor can install the only documented prerequisite and still fail at the first web-development command because `node` is missing or an unsupported version is selected. The generated-doc check stays green because it explicitly asserts the Bun-only sentence.

Root-cause fix: document Bun 1.3.12 and Node 24 together in the local prerequisites and explain which commands use each runtime. Extend `toolchain:check` and the workflow documentation test to enforce the same two-runtime contract so the README cannot drift back to Bun-only guidance.

### C7-DOC-002 — The documented remote PDF fallback omits its required `ANTHROPIC_API_KEY`

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Location: `README.md:157-164`
- Authoritative source: `packages/parser/src/pdf/llm-fallback.ts:207-223`

The README shows `bun run analyze -- ./statement.pdf --allow-remote-llm` and explains consent/non-interactive behavior, but no current operating document tells the user to configure `ANTHROPIC_API_KEY`. The implementation unconditionally reads that variable when the fallback is entered, rejects an empty value, and also enforces an Anthropic key format.

For a scanned or otherwise locally unparseable PDF, a user following the documented command can approve remote processing only to receive “API 키가 설정되지 않아 LLM 폴백을 사용할 수 없습니다.” The omission makes the opt-in feature's sole documented example incomplete.

Root-cause fix: add a short prerequisite beside the remote example that explains how to supply `ANTHROPIC_API_KEY` without committing or printing it, and document the optional model override if it is supported as a user-facing setting. Add a safe environment template or shell-local example and make the README contract test require the key prerequisite whenever the remote flag is documented.

## Missed-defect sweep and coverage statement

The final sweep rechecked runtime/tool versions, setup commands, generated versus hand-written issuer content, card/issuer totals, internal file references, security-hosting qualifications, environment variables, CLI consent behavior, and stale historical language. The 24 issuer indexes and all generated outputs remained source-consistent. The prior Cycle 6 Astro-major and invalid generator-command findings are fixed at this snapshot and were not repeated. External website availability was not network-probed; no finding here depends on an unverified external response.

Result: **2 current findings** (`C7-DOC-001` and `C7-DOC-002`), both confirmed.
