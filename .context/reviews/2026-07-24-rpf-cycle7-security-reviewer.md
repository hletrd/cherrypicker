# Review-plan-fix Cycle 7 — security reviewer

**Review baseline:** `3086a379e31e5b17f82401807f5b3c24325b9962` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified and read all 2,175 tracked paths before the final security pass.
The inventory contains 1,045 context/planning/review paths, 151 web paths, 868
package paths (`core` 36, `parser` 87, `rules` 733, `viz` 12), 59 tool paths,
18 scripts, 15 E2E paths, and 19 root/config/vendor/instruction paths. It
includes 320 tracked TS/JS/Svelte/Astro files, 147 test paths, all 683 authored
card-rule YAML files, and 72 JSON/CSV inputs or generated artifacts. A complete
tracked-file content read succeeded before this report was written.

The security pass traced every externally influenced boundary and its
cross-file consumers:

- browser upload admission, format detection, all parser adapters, worker
  transfer/deserialization, two-lane scheduling, analysis retention,
  persistence, and warning rendering;
- scraper arguments and issuer allowlists through URL parsing, DNS resolution,
  address pinning, redirect revalidation, response bounds, LLM extraction,
  schema validation, and atomic filesystem output;
- CLI statement path validation, local/remote PDF consent, captured-byte
  identity, terminal escaping, report template escaping/CSP, trusted-directory
  checks, no-follow opens, and atomic replacement;
- web CSP and static-host limitations, raw-HTML sites, external URL handling,
  session storage/privacy disclosures, generated data fetching, and report
  output;
- environment variables, credential-like literals, manifests, direct imports,
  lockfile/overrides, vendored XLSX digests, workflow permissions/action pins,
  and dependency audit.

The pass explicitly checked OWASP-style injection/XSS, SSRF and DNS rebinding,
redirect escape, credential leakage, path traversal, symlink/TOCTOU writes,
unsafe deserialization/parser resource use, CSP boundaries, sensitive
persistence, and supply-chain configuration. Historical fixed issues were
verified at their new boundaries rather than re-reported. Known deferred
static-host CSP/header and plaintext same-origin session-storage limitations,
plus previously recorded archive/workbook and streaming redesign debts, were
also excluded from the finding count.

## RPF7-SEC-001 — compact untrusted JSON can exhaust browser memory through diagnostic amplification

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Untrusted parser boundary:** `packages/parser/src/shared/json.ts:114-181,
  232-286`
- **Worker amplification:** `apps/web/src/lib/parser/worker-protocol.ts:48-77,
  113-135`; `apps/web/src/lib/parser/worker-runner.ts:66-115`
- **Admission/concurrency:** `apps/web/src/lib/upload-admission.ts:3-5,42-68`;
  `apps/web/src/lib/file-parse-queue.ts:1,82-141`
- **Too-late rejection/retention:** `apps/web/src/lib/analyzer.ts:156-200,
  333-399`

`parseJSONTransactions()` has no total diagnostic budget. It appends an error
object for every primitive row, missing date/amount, invalid amount/date, and
invalid optional fact. Only one special case, blank merchant, uses the
100-entry counter at lines 125-134. The general rejection paths at lines
144-181 and 270-284 remain proportional to attacker-controlled row count.

The browser worker then maps the full error array into another object graph,
structured-clones it to the main thread, and reconstructs every entry as a
`ParseError`. An all-invalid file is rejected only after that work at
`analyzer.ts:168-172`; adding one valid transaction instead retains the full
array in analysis state. The upload boundary allows 10 MiB per file and 50 MiB
total, and the queue deliberately runs two parser lanes concurrently.

An executable probe at this exact baseline parsed an array of 400,000 `null`
values:

```text
input bytes                 2,000,001
diagnostic objects            400,000
serialized diagnostics     39,888,896 bytes
maximum resident set      199,540,736 bytes
```

That is roughly 20 times input size in the serialized diagnostics alone,
before the worker clone and reconstructed main-thread objects. A 10 MiB
admitted file can contain about two million such rows.

**Concrete scenario:** an attacker sends a user a syntactically valid “card
statement” JSON containing compact `null` rows and one valid transaction. The
file passes the normal size/type admission and technically parses, but opening
it constructs and transfers millions of warning objects. A mobile browser tab
can freeze or be killed; two simultaneous files multiply the peak.

**Root-cause fix:** put one parser-owned, per-file diagnostic collector in
front of every row/fact error path. Give it a small total entry budget and
exact omitted counts, optionally grouped by code. Keep parsing valid rows
after the budget, but return one compact summary. Enforce a second defensive
limit in worker serialization so a future adapter cannot recreate the
amplification. Apply the contract to every row-oriented parser and add
large-invalid/mixed-row tests that assert diagnostic count, omitted count,
serialized size, and server/browser parity.

## Verification

- The executable amplification probe confirmed the 2.0 MiB to 39.9 MiB
  diagnostic expansion and approximately 199.5 MB maximum RSS.
- `bun run dependencies:check`: **passed**; manifests, imports, and vendored
  archive digests were valid.
- `bun run security:audit`: **passed**; Bun reported no dependency
  vulnerabilities.
- 97 focused tests across scraper network policy/fetch bounds/writer safety,
  CLI report output, PDF LLM fallback, report escaping/CSP, parser workers, and
  upload limits: **passed**.
- A credential-pattern filename-only scan of active tracked source found no
  hard-coded Anthropic, AWS, GitHub, Slack, or private-key material.
- No source, test, plan, generated artifact, protected Cycle 42 file, branch,
  commit, deployment, or external state was changed.

## Final missed-issue sweep

The bounded final sweep revisited each URL and redirect hop, public/private IP
classification (including mapped IPv6), response size/encoding, remote LLM
consent and byte identity, terminal/HTML sinks, raw HTML ownership, external
links, CSP and static-host limits, same-origin persistence, file path and
directory identity, symlink races, temporary-file permissions/cleanup,
workflow privilege, action pinning, secrets, dependency overrides, vendored
hashes, and every untrusted parser allocation. No second new,
non-duplicate security issue met the evidence threshold at this baseline.

Final count: **1 Medium finding**, confirmed with High confidence.
