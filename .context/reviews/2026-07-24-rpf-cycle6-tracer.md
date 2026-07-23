# Review-plan-fix Cycle 6 — tracer

**Review baseline:** `449f10a2faffaae2a2c47036070b0e61a5b6eec2` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified all 2,151 tracked paths: 1,028 context/plan/review files, 147 web
files, 865 package files, 59 tool files, 18 scripts, 15 E2E files, and 19
root/config/vendor/instruction files. That includes 309 implementation files,
145 test paths, 683 rule YAML files, and 30 generated JSON/CSV artifacts.
Every review-relevant tracked file was included in the inventory and
source/search pass; no review-relevant file was skipped.

I traced the following end-to-end paths and their failure/cancellation branches:
file admission → quick bank hint → format detection → worker transfer → parse
queue → categorization → optimizer worker → result ownership → persistence →
dashboard/report; category edits → reoptimization → checked aggregation;
YAML/scraper provenance → generated artifacts → web/CLI readers; and CLI
commands → terminal/HTML sinks. I also traced aborts, stale results, malformed
artifacts, storage corruption/truncation, worker errors, and partial multi-file
failures. Historical plans/reviews were searched before classifying an issue
as new.

## RPF6-TRACE-001 — stale quick-detection promise can overwrite the current bank hint

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:201-223,
  226-237,288-316`
- **Visible sink:** `apps/web/src/components/upload/FileDropzone.svelte:629-660`

`detectBankFromFile()` captures the current first file, awaits
`file.slice(0, 4096).text()`, and then writes `detectedBankId` unconditionally.
Adding files and removing the first file start this async function without
awaiting it. `clearAllFiles()` and `beginAdmittedFileMutation()` do not
invalidate quick-detection ownership. The component already uses generation
and abort ownership for the real analysis run, but that ownership does not
cover this independent hint operation.

**Concrete scenario:** file A is selected and its `Blob.text()` is still
pending. The user removes A, making file B first, and a second detection starts.
B resolves first and shows B's issuer. A then resolves and overwrites the badge
with A's issuer even though A is no longer selected. Clearing all files and
then adding B has the same stale-write window: A can resolve after the clear
and persist until another detection completes. Automatic parsing still detects
the actual file independently, so this is misleading UI state rather than an
incorrect optimization result.

**Suggested fix:** give quick detection its own monotonically increasing
generation or `AbortController`. Capture both the generation and first `File`
identity before awaiting, then commit only if the generation is current and
`uploadedFiles[0] === file`. Invalidate it on every admitted mutation, clear,
and component destruction. Add a component/helper test with two deferred
`Blob.text()` promises resolved in reverse order, plus a clear-while-pending
case.

## Verification

- Focused upload/worker/parser unit tests: **67 passed, 0 failed**. Existing
  upload tests cover admission and static interaction wiring but not async hint
  ownership.
- No browser/E2E run was performed, per review constraints.
- No source, plan, protected Cycle 42 file, or pre-existing review provenance
  file was modified.

## Final missed-issue sweep

The final sweep revisited every async mutation and ownership boundary in the
web flow, then checked worker, persistence, artifact, CLI, scraper, and output
error paths. No second new, non-duplicate trace failure was found.
