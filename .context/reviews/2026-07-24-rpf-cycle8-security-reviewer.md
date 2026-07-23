# Review-plan-fix Cycle 8 — security reviewer

- Date: 2026-07-24
- Baseline: `3fd993d471a8676170031f20715f6a53c99e8a9f`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: OWASP-style injection and resource abuse, secrets, authentication,
  filesystem and network boundaries, remote LLM use, and financial-data
  exposure

## Inventory and coverage

The review inventory contains 2,199 tracked paths: 1,062 context/document
paths, 151 web paths, 873 package paths, 59 tool paths, 19 scripts, 16 E2E
paths, and the root/config/workflow/vendor-policy families. Active code and
tests include 76 web source files plus 40 web tests; 26 core source files plus
9 tests; 33 parser source files plus 54 tests; 14 rules source files plus 6
tests; 9 viz source files plus 3 tests; 15 CLI source files plus 9 tests; and
11 scraper source files plus 10 tests. The 683 authored card YAML files and
all generated catalog families were included in boundary and provenance
searches. Six untracked protected Cycle 42 files were excluded without being
modified.

The security pass traced:

- browser upload admission through format sniffing, parser workers,
  structured-clone diagnostics, analysis state, session persistence, and
  Svelte/HTML sinks;
- scraper arguments through issuer/host policy, DNS resolution and pinning,
  redirect revalidation, connected-address checks, response bounds, LLM
  extraction, schema validation, and atomic output;
- CLI input and output paths, local-first PDF parsing, remote-LLM consent and
  captured-byte identity, terminal escaping, standalone-report escaping/CSP,
  directory ownership, no-follow opens, and atomic replacement;
- external URL publication, raw-HTML ownership, static-site CSP limitations,
  same-origin data retention, environment variables, credential-shaped
  literals, manifests, lockfile, vendored XLSX policy, workflow permissions,
  action pinning, and dependency checks.

The Cycle 7 JSON diagnostic, consent-byte, output-path, warning-provenance, and
cap findings were verified as fixed and not repeated. The known static-host
header/CSP and plaintext `sessionStorage` limitations remain explicitly
documented and were not counted again.

## RPF8-SEC-001 — compressed XLSX input has no uncompressed-workbook budget

- **Severity:** Medium
- **Confidence:** High
- **Status:** Likely; malicious-archive execution requires manual validation
- **CWE:** CWE-409 (Improper Handling of Highly Compressed Data)
- **Web compressed-size gate:** `apps/web/src/lib/upload-admission.ts:3-5,
  38-68`
- **Browser expansion boundary:** `apps/web/src/lib/parser/xlsx.ts:264-279,
  308-310`
- **CLI/server whole-file path:** `packages/parser/src/statement.ts:53-61,
  91-97`; `packages/parser/src/xlsx/index.ts:101-113,152-158`
- **Dependency behavior inspected:** `node_modules/xlsx/xlsx.mjs:2786-2833,
  2840-2877`

The browser gate limits only `File.size`, which is the compressed archive
size. It does not inspect XLSX central-directory entry counts, declared
uncompressed sizes, aggregate expansion, or compression ratios. The admitted
bytes are handed directly to `XLSX.read()`. The CLI path has neither that
10 MiB compressed-size gate nor an archive-expansion gate: it reads the whole
file and passes it to the same parser.

The installed SheetJS implementation reads each entry's compressed and
uncompressed sizes and calls its inflate routine with the declared
uncompressed size. No application-owned check runs before that expansion.
The later `sheet_to_json()` conversion occurs only after the workbook archive
has already been opened and its entries inflated.

**Concrete failure:** a highly compressible XLSX can remain below the web's
10 MiB admission limit while declaring or expanding worksheet/shared-string
entries to hundreds of MiB or more. Opening a statement supplied by another
party can exhaust a parser worker/tab; the CLI path can exhaust the process or
host memory. The attacker needs the user or an automation job to parse the
file, so this is an availability issue rather than a remote code-execution
claim.

**Evidence:** repository-wide searches found no central-directory preflight,
per-entry uncompressed limit, aggregate uncompressed limit, compression-ratio
limit, or XLSX entry-count limit before either `XLSX.read()` call. Inspection
of the installed parser confirmed that inflation precedes application-level
row handling. This risk was noted in an older broad review and is reported
only because it is still present at the current baseline. A weaponized archive
was deliberately not executed during this bounded review.

**Fix:** add a browser-safe ZIP central-directory preflight shared by web and
server parser entry points. Reject malformed/ZIP64-overflow metadata and
enforce conservative limits for entry count, per-entry uncompressed bytes,
aggregate uncompressed bytes, and compression ratio before SheetJS sees the
archive. Add a server/CLI compressed-file limit as a second bound. Regression
tests should cover a normal workbook, oversized aggregate expansion, a single
oversized entry, excessive ratio/count, forged size metadata, and web/server
parity without actually allocating the declared payload.

## Verification

- `bun test packages/parser/__tests__/conformance/cycle7-parser-direction.test.ts
  packages/core/__tests__/cycle7-exact-reward-cap-state.test.ts`: **31 passed,
  0 failed**.
- Static secret, dynamic-execution, network, filesystem, HTML-sink, storage,
  workflow-permission, and action-pin sweeps found no second current issue that
  met the evidence threshold.
- No browser/E2E test, network request, commit, deployment, product-source
  change, generated-data change, or protected Cycle 42 file change was made.

## Final missed-issue sweep

The bounded final sweep rechecked URL schemes and credentials, every scraper
redirect/DNS hop, response content/size/encoding bounds, LLM disclosure and
output validation, terminal and HTML escaping, CSP ownership, session data,
path traversal, symlink/TOCTOU handling, temporary-file permissions and
cleanup, workflow privilege, secrets, dependencies, and untrusted parser
allocations. No additional non-duplicate finding met the threshold.

Final count: **1 Medium finding** (`RPF8-SEC-001`).
