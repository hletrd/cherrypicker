# Security Reviewer — Cycle 3

**Reviewer:** security-reviewer
**Date:** 2026-07-23
**Baseline:** `614ce5c` (`docs(reviews,plans): close cycle 2 findings`)
**Result:** 2 confirmed Medium findings; no Critical or High finding.

## Scope and method

I inventoried and reviewed every current production/configuration surface relevant
to a trust boundary: the 66 web source files, 25 core files, 27 parser files,
11 rules files, 4 visualization files, 11 CLI files, 11 scraper files, 16
scripts, all workspace manifests/configuration, the Pages workflow, generated
catalog readers, and the exhaustive 683-card/24-issuer validation path. I also
searched tracked files for common secret formats and dangerous execution/HTML,
filesystem, network, deserialization, terminal, and subprocess sinks.

The material data flows are:

1. statement file -> local/browser parser -> categorizer/optimizer ->
   terminal, generated HTML, or browser `sessionStorage`;
2. remote issuer page -> pinned-DNS scraper -> Anthropic structured output ->
   canonical schema -> YAML -> generated catalog -> web/CLI renderers;
3. CLI arguments -> local filesystem reads/writes or scraper child process; and
4. generated JSON -> strict browser readers -> Svelte's escaped text/authorized
   external links.

The web application is static and has no account, session, authorization, or
server-side API surface. Authentication/authorization findings are therefore
not applicable at this baseline. No credential, private-key, or API-token
material was found in tracked production/configuration files.

## Findings

### C3-SEC-001 — Catalog-controlled terminal strings bypass the terminal sanitizer

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `packages/viz/src/terminal/summary.ts:24-73,75-109`;
  `packages/viz/src/terminal/comparison.ts:16-79`;
  `tools/cli/src/disclosures.ts:36-56,62-72`;
  call sites `tools/cli/src/commands/optimize.ts:130-135` and
  `tools/cli/src/commands/report.ts:137-142`
- **Trust boundary:** scraped/manual catalog and taxonomy strings -> terminal

`tools/cli/src/terminal.ts:1-26` correctly strips OSC, CSI, other escape
sequences, C0/C1 controls, and bidi controls, but it is used only for paths,
parser diagnostics, card numbers, and top-level error text. The visualization
package sends category labels, card names, performance tiers, cap categories,
assignment names, and alternatives directly to `cli-table3` or `console.log`.
The disclosure builder similarly emits `cardId`, `ruleId`, `reason`, and
`detail` without final-sink sanitization.

Those values are not inherently trusted. `packages/rules/src/schema.ts:12-17,
166-199,207-236,254-282` permits unrestricted display strings, and the scraper
can author card names and rule-support prose from a remote page. A safe local
probe passed an OSC clipboard sequence and CSI sequence through
`printCardComparison`; the captured table still contained the exact OSC, BEL,
and CSI bytes. This is distinct from Cycle 2's parser-warning fix: that fix
covered one producer, while these sinks remain unsanitized.

**Failure scenario:** A malformed or adversarial catalog supplied to
`optimize`/`report` places terminal controls in a display field. Printing the
otherwise schema-valid result can rewrite visible lines, create deceptive
links, change styling, or request terminal clipboard behavior.

**Suggested fix:** Put a shared terminal-safe text renderer at every terminal
sink (preferably in `@cherrypicker/viz`, with CLI disclosures using the same
function). Sanitize cells before handing them to `cli-table3`, not only error
producers. Add direct sink tests for OSC-8, OSC-52, CSI, CR/LF, C1, and bidi
payloads in card names, tier/category labels, cap rows, alternatives, and
unsupported-rule details.

### C3-SEC-002 — HTML report output validation follows an existing symlink

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `tools/cli/src/validation.ts:23-64`;
  `tools/cli/src/commands/report.ts:82-87,144-152`
- **Trust boundary:** CLI output coordinate -> local filesystem

`runReport` validates the output with `mustExist: false`, then uses
`writeFileSync(output, html, 'utf-8')`. `validateFilePath` performs `lstat`
only when `mustExist` is true, so an existing output symlink passes validation.
The subsequent write follows it and truncates its target. A defensive temporary
directory probe confirmed that validation returned successfully and the
symlink target changed from its sentinel contents to the report contents.

The condition is particularly relevant to the default
`cherrypicker-report.html` name in a shared or attacker-writable working
directory. It also leaves ordinary existing files subject to unannounced
replacement. This is a local filesystem race/overwrite issue, not a remote web
vulnerability.

**Failure scenario:** A user runs the report command in a directory containing
a pre-existing report-name symlink. Report creation replaces the symlink's
writable target with HTML under the user's privileges.

**Suggested fix:** Treat outputs differently from input validation. Open the
final component with no-follow semantics, default to exclusive create, reject
non-regular existing destinations, and require an explicit overwrite option
for a regular file. If overwrite is supported, revalidate containment/type at
open time and use an atomic temporary-file/rename policy that cannot follow a
symlink. Test final-component symlinks, dangling symlinks, regular-file
replacement policy, and a swap attempt between validation and open.

## Verified defensive controls

- The scraper allowlists hosts, resolves only public IPs, pins DNS resolution,
  checks the connected address, revalidates redirects, bounds responses, and
  rejects unexpected media/encoding (`tools/scraper/src/network-policy.ts`,
  `fetcher.ts`).
- Scraper catalog writes validate issuer/card ID, enforce real-path
  containment, reject symlinks, use `O_NOFOLLOW`, and default to exclusive
  creation (`tools/scraper/src/writer.ts:73-157`).
- Card and issuer external URLs are restricted to absolute credential-free
  HTTP(S), and `_blank` links isolate the opener.
- Browser catalog shards require canonical schema validation and a common
  `sourceHash`; corrupt or mixed generations fail closed.
- Persisted analysis JSON rejects prototype-pollution keys, bounds migrations
  and payload size, and validates restored structures before use. The known
  shallow nested optimizer validation is already tracked as deferred item
  D-91 and is not re-reported here.
- Generated CLI HTML escapes all dynamic text and has a hash-authorized
  stylesheet with scripts disabled. C3-DBG-002 is an availability bug in that
  escaping function, not an HTML injection bypass.
- The Pages workflow pins action SHAs, installs with a frozen lockfile, keeps
  default permissions empty, and grants Pages/OIDC write authority only to the
  deploy job.
- The local-first PDF LLM path requires explicit authorization and does not
  send statement contents merely because local parsing failed.

## Competing hypotheses checked

- `cli-table3` adds its own ANSI styling, but it does not neutralize embedded
  payload controls; captured output retained the exact injected OSC/CSI bytes.
- The report output path rejects symlinks for inputs, but the output call uses
  `mustExist: false`; the guarded branch is therefore unreachable for the
  relevant call.
- Svelte text interpolation is escaped and no production `innerHTML`/raw-HTML
  sink was found, so catalog display strings do not produce a parallel browser
  XSS finding.
- No shell interpolation is used for scraper forwarding; `spawnSync` receives
  an argument array.

## Final missed-issue sweep

The final sweep rechecked raw HTML/script sinks, URL and redirect handling,
worker messages, storage deserialization, CLI subprocesses, path resolution,
all filesystem writes, terminal writes, report interpolation, workflow
permissions/action pins, and tracked secret patterns. It found no additional
actionable Critical/High security issue. Cycle 1/2 controls were not
re-reported unless a present sink remained defective.
