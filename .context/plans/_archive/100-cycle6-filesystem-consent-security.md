# Plan 100 — Cycle 6 Filesystem and Consent Security

**Findings:** C6-013 (Medium/High), C6-014 (Medium/High)  
**Status:** complete  
**Deploy mode:** none

## Evidence

- `tools/cli/src/report-output.ts:61-154` and
  `tools/scraper/src/writer.ts:165-260` validate a directory and then perform
  later path-based file operations that can follow a replaced intermediate
  component.
- `tools/cli/src/parse-statement.ts:40-65` parses a PDF path locally, waits for
  consent, and parses the same pathname again; the PDF extractor reopens it,
  so authorized remote content need not be the inspected bytes.

## Outcome

Report and scraper publication fail closed when the validated output directory
object changes, and local parsing, consent description, and optional remote
PDF fallback all operate on one immutable byte sequence.

## Implementation

1. Encapsulate output-directory trust in a validated capability object that
   records canonical path plus stable directory identity (`dev`/`ino`) and
   holds an open handle where Bun/Node permits it. Revalidate identity before
   every create/replace commit and parent sync.
2. Because the JavaScript runtime exposes no portable `openat`/`renameat`
   family, explicitly restrict the fallback to private/trusted directories:
   every writable ancestor in the selected capability must be owned by the
   effective user and not group/world writable, except a recognized sticky
   system temporary ancestor whose newly created child is private. Fail closed
   with an actionable error when the guarantee is absent or identity changes.
3. Keep final-component `O_NOFOLLOW`, exclusive temporary creation, atomic
   replacement, fsync, containment, and cleanup. Add deterministic operation
   hooks that replace the intermediate directory after validation and prove no
   write reaches the replacement tree.
4. Read the admitted PDF into one bounded immutable buffer before local
   parsing. Add buffer-based PDF extraction/parsing APIs and pass the captured
   buffer to both local and remote-fallback attempts. Include a digest or
   stable byte identity in the consent context without logging document
   content.
5. Keep path checks for admission metadata, but never reopen the pathname to
   determine the bytes sent after consent.

## Tests

- CLI and scraper deterministic swaps before temporary creation, before
  commit, and before sync; untrusted directory modes/ownership; sticky-temp
  allowance; old destination preservation; no escaped write; cleanup.
- PDF tests that replace the pathname during the consent callback and assert
  the remote fallback receives the original captured buffer or fails closed.
- Buffer/path parser parity, size bounds, digest description, denial, and no
  remote-provider invocation before explicit consent.
- CLI, scraper, parser, security, type, lint, unit/Vitest, build, data, and
  final browser gates.

## Acceptance

- [x] Replacing any validated intermediate directory aborts before commit and
  cannot redirect output.
- [x] Untrusted shared output directories are rejected explicitly.
- [x] Consent and remote fallback refer to the exact bytes locally inspected.
- [x] Existing atomicity, no-follow, cleanup, and provider-consent guarantees
  remain intact.

## Completion evidence

- Both writers bind operations to a validated private directory identity,
  revalidate before commit/sync, retain no-follow/atomic behavior, and scrub a
  detached temporary payload without touching a replacement path.
- PDF parsing captures one bounded buffer, supplies defensive copies to local
  and optional remote parsing, and identifies consented bytes by size and
  SHA-256 digest without reopening the pathname.
- The independent security verification passed 100 focused tests plus CLI,
  scraper, and parser type checks, with no remaining blocking defect.

## Execution note

`ralph` is not present. Prompt 3 will use an adversarial manual loop: add the
deterministic race/identity regression first, implement the smallest hardened
boundary, and inspect every filesystem operation before proceeding.
