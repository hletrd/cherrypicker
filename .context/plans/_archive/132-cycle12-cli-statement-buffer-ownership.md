# Plan 132 — Cycle 12 CLI Statement Buffer Ownership

**Finding:** C12-004 (`RPF12-PERF-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- The local-first CLI wrapper eagerly reads and copies the entire statement,
  then gives the parser another full copy and a copied prefix.
- A 128 MiB probe reached 417.2 MiB maximum RSS versus 161.5 MiB for the
  control.
- Analyze, optimize, and report all use this path even when remote fallback is
  disabled.

## Outcome

Ordinary local parsing does not pre-read or duplicate a statement for consent.
When remote fallback is enabled, consent remains bound to the exact bytes that
are retried and the parser cannot switch files between local and remote passes.

## Implementation

1. Add red dependency-seam tests proving remote-disabled parsing does not call
   the wrapper's statement reader.
2. Capture bytes only when the caller has enabled a possible remote fallback.
   Keep one owned snapshot for that flow and avoid avoidable full-size copies.
3. Preserve the current SHA-256/length consent identity and exact-byte retry.
4. Add mutation/race controls for the remote-enabled path and an operation or
   backing-buffer assertion that is deterministic rather than timing-only.
5. Re-run CLI command, parser-read, consent, and subprocess tests.

## Acceptance

- [x] Remote-disabled local parsing performs no consent snapshot read.
- [x] Remote-enabled retry is bound to one exact statement snapshot.
- [x] No second full-size wrapper copy is required for parser delivery.
- [x] Consent denial and typed fallback behavior remain fail-closed.
- [x] Analyze, optimize, and report preserve their current results.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual test-first and bounded-memory-probe fallback. No deployment is
permitted.

## Completion evidence

- Red: five ownership/command regressions failed while 41 existing assertions
  remained green.
- Green: all 101 CLI tests and its TypeScript check passed. The 64 MiB bounded
  probe completed at approximately 103 MiB maximum RSS.
- Commit:
  `8c0e119ffef3b8f9832c0a6c77139ca3d9cf3e40`
  (`⚡ perf(cli): avoid eager statement copies`).
