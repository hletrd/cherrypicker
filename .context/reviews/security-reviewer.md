# Cycle 5 security review

Date: 2026-07-23
Baseline: `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`

## Scope and method

I inventoried all 2,133 tracked paths before reviewing the complete current
security-relevant surface. The review covered the static web application,
browser workers and persistence, all CLI and scraper boundaries, shared
parser/core/rules/viz packages, 683 authored card YAML files and their
publication pipeline, package manifests and lockfile, the vendored SheetJS
archive, GitHub Actions, live documentation, and all current tests. Historical
reviews and completed Cycle 4 plans were searched only to suppress duplicate
findings.

The principal trust-boundary traces were:

- browser file admission -> bounded worker parsing -> categorization ->
  optimization -> session storage and rendered output;
- local CLI file -> local-first parsing -> explicit remote-LLM consent ->
  terminal or standalone report;
- scraper arguments -> exact host policy -> DNS/public-address pinning ->
  bounded redirects/body -> LLM tool output -> canonical validation ->
  no-follow writer; and
- authored YAML -> schema/domain validation -> deterministic generated
  artifacts -> browser and CLI catalog readers.

This revision is a static GitHub Pages application with no accounts, server
API, privileged session, or mutable remote resource, so application
authentication and authorization are not applicable. A tracked-source secret
scan found no credential material; the Anthropic key remains environment-only.
Action references are commit-pinned, workflow permissions are scoped, external
card URLs are constrained to credential-free HTTP(S), scraper DNS/redirect
controls fail closed, dynamic terminal text is sanitized, and report HTML
escapes content under a script-free CSP.

## Finding

### C5-SEC-001 — The locked dependency graph contains known vulnerabilities, but the blocking dependency gate never checks advisories

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed for the vulnerable lock graph and absent gate;
  exploitability of each advisory requires manual validation
- **OWASP:** A06:2021 — Vulnerable and Outdated Components
- **Location:** `apps/web/package.json:20-22`;
  `packages/parser/package.json:24`;
  `tools/scraper/package.json:18-19`;
  `package.json:13-28,34-40`;
  `bun.lock:535,609,619,659,681,691,769,973,1033,1057,1061,1089,1103,1137,1201,1261`;
  `scripts/check-dependencies.ts:285-343`;
  `.github/workflows/deploy.yml:24-45`

Current-lock evidence:

- `bun audit --json` on 2026-07-23 reported **40 advisories across 15
  packages: 18 high, 16 moderate, and 6 low**.
- Directly or transitively locked affected versions include Astro `6.1.4`,
  Svelte `5.55.0`, Vite `7.3.1`, undici `7.24.5`, form-data `4.0.5`, SVGO
  `4.0.1`, Turbo `2.8.20`, fast-uri `3.1.0`, js-yaml `4.1.1`, PostCSS
  `8.5.8`, sharp `0.34.5`, devalue `5.6.4`, defu `6.1.4`, and esbuild
  `0.27.4`; a nested `yaml@2.7.1` is also present.
- The graph includes reviewed high-severity issues such as Vite arbitrary
  dev-server file read
  ([GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583)),
  Vite `server.fs.deny` bypass
  ([GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r)),
  and form-data CRLF injection
  ([GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx)).
- `dependencies:check` verifies direct import declarations, unauthenticated
  remote references, and vendor digests/references. Neither it nor `verify` or
  the deployment workflow queries an advisory database, so all 40 findings
  currently pass the release gates.

Failure scenario:

1. A maintainer installs the frozen graph and exposes the documented
   Astro/Vite development server to a network, or a later change begins using
   one of the affected Svelte/Astro/undici/form-data paths.
2. The repository remains green because integrity and declaration checks do
   not test whether the authenticated bytes are known-vulnerable.
3. An attacker exercises the relevant upstream flaw; for example, the Vite
   advisory permits arbitrary development-machine file disclosure when its
   documented network-exposure precondition is met.

The present production deployment is static, the default dev server is not
network-exposed, no `{@html}` sink was found, scraper HTTP uses its own pinned
`node:http`/`node:https` path rather than undici loading, and the current
Anthropic calls do not pass attacker-chosen multipart field names. Those facts
reduce current reachability and are why this is Medium rather than inheriting
the advisories' maximum upstream severity. They do not make the stale graph or
missing release control disappear.

Suggested fix:

1. Upgrade direct dependencies and regenerate `bun.lock` until reviewed
   high/moderate findings are removed. Key current floors include Svelte
   newer than `5.55.6`, Vite newer than `7.3.4`, undici `7.28.0+`,
   form-data `4.0.6+`, SVGO `4.0.2+`, Turbo `2.9.14+`, fast-uri newer than
   `3.1.3`, js-yaml `4.3.0+`, PostCSS `8.5.10+`, and sharp `0.35.0+`;
   select a mutually compatible patched Astro line rather than forcing these
   transitives independently.
2. Add a lockfile advisory scan after the frozen install in `verify`/CI.
   If the pinned Bun version cannot provide the scanner, use a deterministic
   OSV-compatible scanner or upgrade the pinned toolchain first.
3. Make any temporary exception explicit by advisory ID, dependency path,
   reachability rationale, owner, and expiry; do not use a blanket severity
   ignore.
4. Re-run unit, build, and browser tests and manually validate the dev-server,
   static output, scraper, and remote-PDF paths after the upgrade.

## Validation and missed-file sweep

- `bun run test`: 2,457 tests passed across 99 files, zero failures.
- `bun run test:e2e`: all 93 browser regressions passed.
- `bun audit --json`: reproduced the counts above.
- `bun pm ls --all`: confirmed the reported versions are installed from the
  current lock.
- Final searches covered credentials, environment access, executable HTML
  sinks, child processes, network calls, URL construction, filesystem writes,
  symlinks, storage, worker messages, and workflow action references.
- Previously accepted/deferred observations such as the static-host CSP
  limitation and plaintext per-tab session storage were not relabeled as new
  Cycle 5 findings.
