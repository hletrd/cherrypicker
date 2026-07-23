# Review–Plan–Fix Cycle 6 — Security Reviewer

- Date: 2026-07-24
- Baseline: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Lens: OWASP-style secure-code review of trust boundaries, input/output/storage handling, secrets, filesystem and network behavior, dependencies, and configuration
- Scope: review only; no product source, tests, plans, generated artifacts, or protected Cycle 42 evidence changed

## Inventory and coverage

I classified all 2,151 tracked paths: 1,028 context/plan/review files, 147 web
files, 865 package files, 59 tool files, 18 scripts, 15 E2E files, and 19
root/config/vendor/instruction files. The inventory includes 309 implementation
files, 145 test paths, 683 authored card-rule YAML files, and 30 generated
JSON/CSV artifacts. Every review-relevant path was included in the inventory
and source/search pass. High-volume rule and generated data was assessed
through its complete schema, semantic-validation, publication, and artifact
boundaries rather than treated as untrusted executable code.

I read the repository instructions, product contract, workspace manifests,
compiler/test/build configuration, deployment workflow, and all
behavior-bearing source and test areas. The security trace covered:

- file admission, format detection, parsing, PDF extraction, remote-LLM
  consent and transmission;
- scraper fetch policy, redirect and DNS checks, model output validation,
  serialization, and filesystem publication;
- CLI argument and path validation, catalog loading, report preparation, and
  report output;
- browser workers, persistence, imported artifacts, HTML/terminal sinks, and
  cross-package data flows;
- environment-variable and credential reads, logging/error surfaces,
  dependency manifests and lockfile, workflow permissions, suppressions, and
  unsafe-default patterns.

Existing Cycle 6 provenance was checked for duplication only after the
independent pass. Previously reported Cycle 6 findings were not repeated.

## Findings

### RPF6-SEC-001 — output protection does not bind writes to the validated directory object

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Code regions:**
  - `tools/cli/src/report-output.ts:61-68,70-81,84-127,129-154`
  - `tools/scraper/src/writer.ts:165-196,210-260`
- **Test gaps:**
  - `tools/cli/__tests__/report-output.test.ts:58-76,101-153`
  - `tools/scraper/__tests__/writer.test.ts:97-130`

Both writers canonicalize and validate a directory, then retain only its
pathname for later `open`, `rename`, `link`, `unlink`, and directory-sync
operations. `O_NOFOLLOW` protects the final component passed to `open`; it
does not stop the kernel from following a replaced symbolic link in an
intermediate directory component. The later `lstat` checks are also
path-based and do not bind the operation to the directory object that was
validated.

**Failure scenario:** while CherryPicker is writing into a shared or otherwise
concurrently writable output parent, another local principal renames the
validated parent/issuer directory and replaces its old name with a link to a
different directory. The remaining pathname-based create or replacement can
then land outside the selected output tree. In overwrite mode this can replace
a same-named report or card-rule file in that other directory. The current
tests cover swaps of the final file component and an issuer link that already
exists before validation, but not replacement of a validated intermediate
directory between validation and commit.

**Suggested fix:** perform creation and commit relative to directory file
descriptors that remain open from validation through commit, using
`openat`/`renameat`-style operations with no-follow semantics for every
component. If the JavaScript runtime cannot provide those primitives, isolate
the capability in a small audited native/helper boundary or explicitly limit
these commands to non-shared trusted output directories and fail closed when
that guarantee cannot be established. Add deterministic tests that exchange
the intermediate directory at the existing operation hooks and prove that no
write escapes the originally opened directory.

### RPF6-SEC-002 — remote-PDF consent is not bound to the bytes that were locally inspected

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Code regions:**
  - `tools/cli/src/parse-statement.ts:40-65`
  - `packages/parser/src/statement.ts:100-108`
  - `packages/parser/src/pdf/index.ts:12-20,33-64`
  - `packages/parser/src/pdf/extractor.ts:32-35`
  - `tools/cli/src/consent.ts:31-33,47-75`
  - `tools/cli/src/validation.ts:43-65`
- **Test gap:** `tools/cli/__tests__/commands.test.ts:272-300,352-379`

The local-first flow parses the PDF path once with remote access disabled,
waits for authorization, and then calls the whole parser on the same pathname
again with remote access enabled. Each PDF parse calls `extractText(filePath)`,
which opens and reads the file again. Consequently, the consent applies to a
pathname and a size description, not to an immutable byte sequence or digest.
The earlier final-component symlink check does not bind either parse to a
particular file object.

**Failure scenario:** the file or one of its parent-directory entries changes
after the local parse but before the authorized retry. The remote attempt
extracts the replacement content and may send up to 8,000 characters of that
different document to Anthropic, even though the user made the decision while
the original document was the one locally inspected. This is a privacy and
consent-integrity failure when an input resides in a synchronized, shared, or
otherwise concurrently writable location.

**Suggested fix:** open/read the PDF once and carry an immutable buffer or
extracted-text object through local parsing, the consent prompt, and the
authorized remote fallback. Include a digest or stable document description in
the consent context for auditability. If reopening is unavoidable, retain the
original file descriptor and verify the content digest before transmission;
path-only `stat` checks are insufficient. Extend the local-first tests so the
input identity changes during the authorization callback and assert that the
remote fallback either uses the original captured content or fails closed.

## Verification

- Focused CLI output/consent, scraper writer, and optimizer suites: **88 passed,
  0 failed** across four test files. The passing output tests cover
  final-component links but not the intermediate-directory race described
  above; the consent tests confirm the local → authorization → second-parse
  sequence but do not bind document identity.
- `bun run data:check`: **passed** for all 683 authored rules, generated
  artifacts, category fallback, and README catalog.
- No browser or E2E run was performed, per review constraints.

## Final missed-issue sweep

The bounded final sweep rechecked secret-bearing environment reads and logs,
HTML and terminal output encoding, URL/DNS/redirect handling, filesystem
containment and atomic-write assumptions, consent boundaries, browser storage,
workflow permissions, dependency/config surfaces, and unsafe exception
fallbacks. No additional new, non-duplicate issue met the threshold for an
evidence-backed finding. No hard-coded production credential or newly exposed
secret was found.

Final count: **2 Medium findings**, both confirmed with High confidence.
