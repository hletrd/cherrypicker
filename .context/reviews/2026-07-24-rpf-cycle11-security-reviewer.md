# Review-plan-fix Cycle 11 — security reviewer

- Date: 2026-07-24
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP Top 10, secrets, authentication/authorization, unsafe
  patterns, and cross-file trust boundaries
- Disposition: **pass — no genuinely new current-HEAD security finding**
- Scope: review and this report only; no source, test, generated artifact,
  staging, commit, push, deployment, browser, E2E, or external-system change

## Inventory and coverage

I classified all **2,274 tracked paths** before the final security sweep:
**1,113** `.context` review/plan paths and **1,161** active product, data,
test, documentation, workflow, configuration, and vendor-integrity paths.
The active inventory includes:

- web: 78 source paths, 55 tests, and 32 public assets/artifacts;
- core: 26 source paths and 14 tests;
- parser: 35 source paths and 49 tests;
- rules: 14 source paths, 7 tests, and all 683 authored card YAML files;
- visualization: 9 source paths and 3 tests;
- CLI: 16 source paths and 10 tests;
- scraper: 12 source paths, 11 tests, and all 10 issuer target files;
- 19 scripts, 16 E2E paths, and the remaining root manifests, lockfile,
  workflow, compiler/build configuration, README, and vendored SheetJS
  integrity files.

High-volume authored and generated catalog data was reviewed through the
complete schema, semantic-validation, generation, source-hash, freshness, and
browser/CLI loading boundaries. The cross-file security trace covered:

1. browser admission limits, format sniffing, every parser family, XLSX ZIP
   preflight, parser workers, diagnostics, analysis workers, persistence, and
   Svelte/Astro sinks;
2. CLI path admission, one captured statement byte sequence, local-first PDF
   parsing, explicit remote-LLM consent, Anthropic request/response bounds,
   terminal sanitization, standalone-report escaping/CSP, and report writes;
3. scraper argument and issuer policy, exact host normalization, public DNS
   resolution, pinned socket addresses, redirect revalidation, bounded HTML
   reads, untrusted-page LLM extraction, deterministic quarantine, schema
   validation, and filesystem publication;
4. canonical IDs and URLs, rule/catalog schemas, authored YAML, generated
   public JSON, runtime detail loading, and external-link rendering; and
5. environment reads, credential-shaped literals, subprocesses, filesystem
   operations, dependency manifests/lock/overrides, vendored digests,
   workflow permissions, action pins, and deployment configuration.

The deployed product remains a static client application. It has no account,
cookie, server session, database, mutable privileged API, or application
role/permission surface. The material authorization decision is the CLI's
explicit consent before transmitting captured PDF text to the remote provider.

## Current trust-boundary result

No genuinely new finding met the evidence threshold.

The Cycle 10 phishing-link path is closed at every relevant current boundary.
The extraction tool and prompt no longer give the model a `card.url` field;
`stampTrustedExtractionBoundary()` removes an adversarial URL, stamps issuer,
date, and `llm-scrape` provenance outside model authority, and downgrades
model-supported rewards pending source review
(`tools/scraper/src/extractor.ts:99-113`,
`tools/scraper/src/prompts/schemas.ts:1-66`,
`tools/scraper/src/prompts/system.ts:12-37`). Canonical metadata then rejects a
non-empty official URL while provenance is still `llm-scrape`
(`packages/rules/src/schema.ts:267-285`). Publication and browser loading use
that canonical schema, while final links are independently restricted to
unchanged, credential-free absolute HTTP(S) URLs.

The remaining untrusted flows also fail closed:

- scraper requests re-resolve and revalidate every redirect hop, reject any
  non-public DNS answer, pin the connection lookup, verify the connected
  socket address, cap redirects/body/time, and accept only HTML media types
  with supported encodings (`tools/scraper/src/network-policy.ts:198-324`,
  `tools/scraper/src/fetcher.ts:220-315`);
- scraper and report writers validate containment, ownership/mode and stable
  directory identity, retain open directory handles, reject links/non-regular
  destinations, create private exclusive temporaries, and revalidate before
  commit/sync (`tools/scraper/src/writer.ts:106-379`,
  `tools/cli/src/report-output.ts:75-343`);
- the standalone report escapes every dynamic text field, performs one-pass
  exact placeholder replacement, contains no script, and hashes its sole
  inline stylesheet in a restrictive CSP
  (`packages/viz/src/report/generator.ts:47-113,132-455`,
  `packages/viz/src/report/templates/report.html:1-6`);
- browser uploads are bounded before parsing, XLSX metadata is budgeted before
  SheetJS inflation, diagnostics are capped, worker failures settle, persisted
  state is structurally/coherently decoded, and the only raw-HTML component
  sink consumes the repository-owned static icon table.

## Historical reconciliation

Current and archived security reports, aggregates, and their relevant plans
were checked after the independent pass. Fixed findings were verified at
their new boundaries rather than relabeled:

- Cycle 6 output-directory identity and captured-byte consent are closed by
  archived Plan 100.
- Cycle 7 diagnostic amplification and Cycle 8 XLSX expansion are closed by
  bounded collectors/worker serialization and shared ZIP preflight.
- Cycle 9 scraper prompt/source authority is closed by untrusted-source
  delimiting plus deterministic unsupported quarantine.
- Cycle 10 model-authored official URLs and private card-ID grammar are closed
  by completed Plan 122.

Known prior limitations were not counted again: static-host response-header
constraints and the documented `unsafe-inline` web CSP fallback, plaintext
same-origin `sessionStorage`, CLI whole-file/resource redesign debt, and the
PDF LLM blacklist/prompt-injection limitation. The leading-NUL/prefixed-XLSX
inflation hypothesis remains rejected: non-`PK` input follows SheetJS's
plaintext/PRN dispatch and does not enter ZIP inflation. No new evidence
changes that conclusion.

## Verification and final missed-issue sweep

- `bun run dependencies:check` passed: direct production imports, remote
  dependency-reference policy, vendored archive references, and pinned
  SHA-256/SHA-512 digests are valid.
- `package.json` and `bun.lock` are unchanged from the Cycle 10 dependency
  audit baseline. No online advisory call was made under this role's
  no-external-side-effect constraint.
- Every workflow action is pinned to a full commit SHA. The workflow starts
  with no permissions, grants build only `contents: read`, grants Pages/OIDC
  writes only to the deploy job, disables checkout credential persistence,
  and installs from the frozen lockfile.
- A value-safe tracked-tree secret sweep found no private-key marker, tracked
  environment/key container, or credential-shaped OpenAI, GitHub, AWS, Slack,
  or Google secret. Anthropic-shaped matches occur only in four scraper test
  fixture files; no value is reproduced here. Runtime provider keys remain
  environment-only and are validated without being logged.

The closing sweep revisited authentication/authorization applicability,
secrets and logs, XSS/raw HTML, terminal injection, unsafe URL schemes, SSRF,
DNS rebinding, redirects, response/parser/archive resource limits,
deserialization and prototype boundaries, LLM input/output authority,
sensitive browser storage, path traversal, symlink/TOCTOU writes, temporary
file cleanup, subprocess argument handling, dependency provenance, workflow
privilege, and action pinning. It found no Critical, High, Medium, or Low
genuinely new non-duplicate security issue at the reviewed revision.

Final count: **0 new findings**.
