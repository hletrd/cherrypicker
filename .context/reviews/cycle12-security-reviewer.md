# Review-plan-fix Cycle 12 — security reviewer

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP Top 10, secrets, unsafe parsing, injection/XSS,
  authentication/authorization, supply-chain boundaries, untrusted uploads,
  resource abuse, privacy, path/network risks, and cross-file behavior
- Method status: **confirmed by manual static source/history review**
- Disposition: **pass — no genuinely new current-HEAD security finding**
- Scope: review and this report only; no implementation, source/test/generated
  artifact change, staging, commit, push, server, browser, E2E, deployment, or
  external-system mutation

## Finding count and required fields

**Final count: 0 new findings.**

There is no finding row to which an original severity, confidence,
confirmed/likely/manual status, exploit or failure scenario, or remediation
can truthfully be assigned. No Critical, High, Medium, or Low candidate met
the evidence and novelty threshold.

## Inventory and coverage

I classified all **2,291 tracked paths** before the closing sweep:
**1,129** `.context` review/plan paths and **1,162** active product, data,
test, documentation, workflow, configuration, and vendor-integrity paths.
The active inventory includes:

- web: 78 source paths;
- core: 26 source paths;
- parser: 35 source paths;
- rules: 14 source paths and all 683 authored card YAML files;
- visualization: 9 source paths;
- CLI: 16 source paths;
- scraper: 12 source paths;
- 19 scripts and 174 combined unit/integration/E2E test paths; and
- the remaining public/generated artifacts, manifests, lockfile, workflow,
  compiler/build configuration, documentation, and vendored SheetJS archive
  integrity files.

High-volume authored and generated card data was assessed through its complete
schema, semantic validation, publication, source-hash, freshness, runtime
reader, and rendering boundaries. The cross-file trace covered:

1. browser upload admission, format detection, every parser family, shared
   XLSX ZIP preflight, parser/optimizer workers, bounded diagnostics,
   persistence decoding, and Svelte/Astro sinks;
2. CLI path admission, captured statement bytes, local-first PDF parsing,
   explicit remote-LLM consent, Anthropic request/response bounds, terminal
   sanitization, standalone-report escaping/CSP, and safe output writes;
3. scraper argument/issuer policy, host normalization, public-only DNS,
   pinned connections, redirect revalidation, bounded HTML reads, untrusted
   page-to-LLM flow, deterministic model-output quarantine, schema validation,
   and filesystem publication;
4. canonical IDs and external URLs, rules/catalog schemas, authored YAML,
   generated browser JSON, detail loading, source identity, and final link
   rendering; and
5. environment reads, credential-shaped literals, subprocesses, filesystem
   operations, dependency manifests/lock/overrides, vendored digests,
   workflow permissions, action pins, and deployment configuration.

The deployed application remains static and client-only. It has no account,
cookie, server session, database, privileged mutable API, or application
role/permission surface. Authentication and server-side authorization are
therefore not applicable. The material authorization decision is the CLI's
explicit consent before captured PDF text may leave the machine.

## Current revision trust-boundary result

No Cycle 11 repair introduced a new security weakness.

- Source links still pass the shared unchanged-value HTTP(S), no-credentials,
  no-control-character guard before `URL` derives a display hostname
  (`packages/rules/src/security.ts:30-48`,
  `apps/web/src/lib/external-url.ts:8-21`). Svelte escapes both the guarded
  `href` and derived hostname, and the new tab carries
  `noopener noreferrer`
  (`apps/web/src/components/cards/CardDetail.svelte:147,268-286`).
- Composed amount signs are reduced to one negative polarity without adding
  code evaluation, permissive numeric tails, or unsafe integers
  (`packages/parser/src/shared/amount.ts:25-53`).
- Merchant-boundary metadata is compiled from repository-owned taxonomy and
  keyword strings, frozen, and matched with `indexOf`/character-code checks;
  it does not construct executable code or attacker-controlled regular
  expressions (`packages/core/src/categorizer/normalize.ts:14-130`,
  `packages/core/src/categorizer/matcher.ts:142-224`,
  `packages/core/src/categorizer/taxonomy.ts:42-261`).
- Rule-scoped cap identity remains internal structured data. Worker responses
  require valid rule/cap-group identity and numeric ordering, while
  persistence deliberately preserves identity-free entries for the already
  deployed v4 compatibility shape and still performs exhaustive structural and
  cross-field coherence checks
  (`apps/web/src/lib/optimizer/worker-protocol.ts:72-181`,
  `apps/web/src/lib/persistence.ts:247-313,624-825`,
  `apps/web/src/lib/analysis-result.ts:254-455`).

The broader untrusted boundaries also remain fail-closed:

- Browser admission caps each file at 10 MiB, the batch at 50 MiB, and the
  count at 50 before parsing (`apps/web/src/lib/upload-admission.ts:3-70`).
  ZIP metadata is checked without inflation for compressed size, entry count,
  per-entry/total expansion, ratio, encryption, method, ZIP64/multi-disk
  markers, header agreement, and byte ranges before SheetJS receives an XLSX
  archive (`packages/parser/src/shared/xlsx-archive.ts:1-296`).
- Persisted JSON rejects prototype-related keys, requires plain objects and
  bounded warnings, validates every nested numeric/string shape, and verifies
  financial coherence before restoration
  (`apps/web/src/lib/persistence.ts:56-118,247-825`). The sole production raw
  HTML sink selects only repository-owned static SVG path strings
  (`apps/web/src/components/ui/Icon.svelte:1-60`).
- Local PDF parsing is attempted first against one captured byte sequence.
  Remote retry requires the typed fallback signal, `--allow-remote-llm`, and
  either an interactive confirmation or explicit `--yes`; the consent
  identifies the exact captured digest and size
  (`tools/cli/src/parse-statement.ts:28-83`,
  `tools/cli/src/consent.ts:14-81`). Remote input/output is bounded and the
  returned transaction array is structurally and numerically validated
  (`packages/parser/src/pdf/llm-fallback.ts:55-243`).
- Standalone reports escape every dynamic text field, replace a closed
  placeholder set in one pass, execute no script, and hash their sole inline
  stylesheet in a restrictive CSP
  (`packages/viz/src/report/generator.ts:47-113,132-469`,
  `packages/viz/src/report/templates/report.html:1-6`). Report and scraper
  writers validate path containment, directory ownership/mode and stable
  identity, use retained directory handles, reject links/non-regular
  destinations, create private exclusive no-follow temporaries, and
  revalidate before commit/cleanup
  (`tools/cli/src/report-output.ts:75-323`,
  `tools/scraper/src/writer.ts:106-403`).
- Scraper requests accept exact configured hosts, reject credentials and
  non-public/mixed DNS answers, pin lookup results, verify the connected
  socket, and repeat validation for every redirect
  (`tools/scraper/src/network-policy.ts:162-324`,
  `tools/scraper/src/fetcher.ts:21-315`). Response type, encoding, redirect
  count, body size, and one operation deadline are bounded. Page text is
  JSON-delimited as untrusted input; model-authored URLs are deleted, issuer
  and provenance are stamped outside model authority, rewards are quarantined
  pending review, truncation fails closed, and canonical validation precedes
  publication (`tools/scraper/src/extractor.ts:10-217`).

## Historical reconciliation

I checked the current aggregate, the Cycle 5-11 security reports and
aggregates, archived repair plans, and the active deferred register after the
independent pass. Fixed findings were verified at their current boundaries
rather than relabeled:

- Cycle 2/4 action-pin, workflow-permission, subprocess, and terminal-control
  findings remain closed.
- Cycle 6 output-directory identity and captured-byte consent remain closed
  by archived Plan 100.
- Cycle 7 diagnostic amplification and Cycle 8 XLSX archive expansion remain
  closed by bounded collectors/serialization and shared ZIP preflight.
- Cycle 9 scraper prompt/source authority remains closed by untrusted-source
  delimiting and deterministic unsupported quarantine.
- Cycle 10 model-authored URLs and private card-ID grammar remain closed by
  archived Plan 122.
- Cycle 11's source-label repair changes copy and visible destination
  identity; it does not weaken the URL or rendering guard.

Known prior limitations were not counted again: static-host response-header
constraints and the documented `unsafe-inline` web CSP fallback
(`apps/web/src/layouts/Layout.astro:53-67`), plaintext same-origin
`sessionStorage`, CLI whole-file/resource redesign debt, the PDF LLM
blacklist/prompt-injection limitation, HTML normalization that is never used
as a render sink, and the previously documented OFX regular-expression
candidate.

The prefixed/leading-NUL XLSX ZIP-inflation hypothesis remains rejected.
Current preflight enters ZIP inspection only for a `PK` prefix at byte zero;
non-`PK` input returns `not-zip` and follows SheetJS's legacy/plaintext
dispatch (`packages/parser/src/shared/xlsx-archive.ts:113-132`). The full
current trace produced no new reproducible evidence to change that result, so
the rejected candidate is not resurrected.

## Verification and final missed-issue sweep

- `bun run dependencies:check` passed: production imports, remote dependency
  references, vendored archive references, and pinned SHA-256/SHA-512 digests
  are valid.
- `package.json`, workspace manifests, `bun.lock`, and
  `.github/workflows` are unchanged from the Cycle 11 dependency/workflow
  audit baseline. No online advisory call was made for this review-only role.
- The workflow begins with no permissions, grants build only `contents: read`,
  grants Pages/OIDC writes only to the deploy job, disables checkout
  credential persistence, installs from the frozen lockfile, and pins every
  action to a full commit SHA (`.github/workflows/deploy.yml:8-75`).
- A value-safe tracked-tree secret sweep found no private-key marker, tracked
  environment/key container, or credential-shaped AWS, OpenAI, GitHub, Slack,
  Google, or Anthropic secret. Anthropic-prefix occurrences are confined to
  documentation, validation/error wording, and synthetic test fixtures; no
  value is reproduced here. Runtime provider keys remain environment-only and
  are not logged.
- The tracked tree contains no symbolic link or Git submodule boundary. The
  six protected untracked Cycle 42 artifacts were not read-modified-written,
  staged, or otherwise changed.

The mandatory closing sweep revisited authentication/authorization
applicability, secrets/logs, XSS/raw HTML, terminal control injection, unsafe
URL schemes and source-label confusion, SSRF/DNS rebinding/redirects,
response/parser/archive resource limits, deserialization/prototype keys,
worker-message validation, LLM input/output authority, browser-storage
privacy, traversal/symlink/TOCTOU writes, temporary cleanup, subprocess
argument handling, dependency provenance, workflow privilege, action pinning,
and the complete current diff. It found no genuinely new security issue.

Final count: **0 new findings**.
