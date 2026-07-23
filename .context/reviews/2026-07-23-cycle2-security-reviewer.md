# Cycle 2 security review

Date: 2026-07-23
Role: security-reviewer
Result: 2 new findings (2 Medium)

## Scope and inventory

I inventoried the tracked tree before reviewing it. The security-relevant production inventory was:

| Area | Tracked files reviewed |
|---|---:|
| `apps/web/src/**` | 56 |
| `apps/web/public/**` runtime scripts | 3 |
| `packages/core/src/**` | 22 |
| `packages/parser/src/**` | 25 |
| `packages/rules/src/**` | 11 |
| `packages/rules/data/cards/**` | 707 (683 YAML rules and 24 issuer READMEs) |
| `packages/viz/src/**` | 5 |
| `tools/cli/src/**` | 9 |
| `tools/scraper/src/**` | 11 |
| `scripts/**` | 16 |

I also inspected the complete relevant test inventory (`apps/web/__tests__` 24, `e2e` 9, core 5, parser 48, rules 5, viz 1, CLI 2, scraper 9, and script tests), the root/package manifests and TypeScript configs, `bun.lock`, both Playwright configs, Astro config, `bunfig.toml`, `.github/workflows/deploy.yml`, `README.md`, `.claude/AGENTS.md`, and `.claude/CLAUDE.md`. Tests were inventoried by file and test case, not sampled.

The review traced statement bytes, rule/catalog data, URLs, file paths, browser persistence, generated HTML, terminal output, scraper networking, CI credentials, and deployment artifacts through their sinks. Secret/auth/database searches found no server-side authentication or database surface in this static application.

## Reconciliation with Cycle 1

Cycle 1's path traversal, unsafe external-card URL, ineffective meta clickjacking claim, and scraper SSRF/unbounded-body findings are fixed in the current tree and are not repeated. The documented GitHub Pages header limitation, the deliberately deferred web CSP `unsafe-inline` work, and plaintext same-origin `sessionStorage` are likewise not relabeled as new findings. Report HTML escaping is present and effective for the ordinary HTML metacharacter cases covered by the viz tests.

## Findings

### C2-SEC-01 — Mutable Actions tags execute in a workflow with globally elevated Pages/OIDC permissions

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed configuration; exploitation requires an upstream tag/release compromise**
- Location:
  - `.github/workflows/deploy.yml:8-11`
  - `.github/workflows/deploy.yml:21,23,27,48,57,59,71`

Evidence:

- Workflow-level permissions grant `pages: write` and `id-token: write`, so those capabilities are also available to the `build` job even though deployment is a separate job.
- Every referenced action is selected through a mutable major tag: `actions/checkout@v4`, `oven-sh/setup-bun@v2`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, and `actions/deploy-pages@v4`.
- The build job runs third-party action code and constructs the exact browser artifact later published as the financial-statement application.

Exploit/failure scenario:

If an action tag or its release channel is compromised, code executing in the build job can alter the deployed JavaScript, steal a job OIDC token, or misuse the Pages-capable token. A malicious deployed bundle could then read statements and analysis results that users intentionally process locally, directly defeating the privacy boundary advertised by the project.

Competing hypothesis:

Major-version tags are common for GitHub-maintained actions and an upstream compromise is less likely than an application bug. They are still mutable references, and the workflow-level permission grant unnecessarily expands the consequence of that compromise; job-scoped permissions and immutable SHAs materially reduce both risks.

Suggested fix:

Pin every action to a reviewed full commit SHA and let Dependabot/Renovate propose SHA updates. Set the build job to `contents: read` only (and consider `persist-credentials: false` on checkout); grant `pages: write` and `id-token: write` only to the protected deploy job/environment. Add a policy check that rejects non-SHA `uses:` references and workflow-level write permissions.

### C2-SEC-02 — Untrusted statement fields reach terminal control-sequence sinks unchanged

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed**
- Location:
  - `packages/parser/src/json/index.ts:116-143,245`
  - `packages/parser/src/csv/adapter-factory.ts:153-174`
  - `packages/parser/src/csv/generic.ts:238-265`
  - `packages/parser/src/ofx/index.ts:179-182,243`
  - `tools/cli/src/commands/analyze.ts:64-67`
  - `tools/cli/src/commands/optimize.ts:84-87`
  - `tools/cli/src/commands/report.ts:91-94`

Evidence and trace:

1. JSON, CSV, and OFX parsers interpolate the raw, untrusted date into a `ParseError` when validation fails.
2. Several of those paths still append the invalid transaction, but the injection does not depend on later optimization: all three CLI commands immediately interpolate `e.message` into `console.warn`.
3. There is no control-character, ANSI/ECMA-48, OSC, or bidirectional-control sanitization at the parser-to-terminal boundary.
4. A read-only probe using a JSON date containing OSC-8 bytes returned:

   ```json
   {"transactions":1,"errors":1,"storedDate":"\u001b]8;;https://example.invalid\u0007spoof\u001b]8;;\u0007","message":"날짜를 해석할 수 없습니다: \u001b]8;;https://example.invalid\u0007spoof\u001b]8;;\u0007","hasEsc":true,"hasBel":true}
   ```

Exploit/failure scenario:

An attacker supplies or convinces a user to inspect a crafted downloaded statement. Running `cherrypicker analyze`, `optimize`, or `report` emits the embedded bytes to the terminal. Depending on the terminal, the statement can spoof warning/output lines, add deceptive hyperlinks, change titles, or invoke enabled OSC clipboard behavior. This is terminal-output manipulation rather than arbitrary shell command execution.

Competing hypothesis:

Real bank dates normally contain digits and separators. The generic JSON/CSV/OFX inputs are nevertheless explicitly external and accept arbitrary strings before validation, which is exactly the path exercised by the probe.

Suggested fix:

Introduce one terminal-safe rendering boundary used by every CLI/viz console sink. Strip or visibly escape C0/C1 controls (except deliberately handled line structure), ESC/CSI/OSC sequences, and bidi override/isolate controls before printing. Keep original values only in structured data or files. Add regression tests containing CSI, OSC-8, OSC-52, carriage-return, and bidi-control payloads across all three commands.

## Missed-issue and file-coverage sweep

After documenting the findings, I repeated sink-oriented searches for `console.*`, raw HTML insertion, CSP, URL opening, filesystem writes/resolution, subprocesses, network requests, secrets/environment use, cookies/storage, workflow permissions, and mutable `uses:` references, then followed each hit to its caller and tests. I also rechecked every production file listed in the inventory and reconciled matches against completed/deferred Cycle 1 work. No additional distinct security finding survived that sweep.
