# Plan 133 — Cycle 12 Source Host Contrast

**Finding:** C12-005 (`RPF12-D-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- The 14 px source hostname uses `#64748b` over issuer-tinted light headers.
- Measured contrast is about 3.67:1 on the strongest Shinhan tint and below
  4.0:1 on sampled production pixels.
- The hostname is the destination/provenance cue introduced by Plan 128.

## Outcome

The source hostname remains visually subordinate but meets at least 4.5:1
contrast over every supported issuer tint in light and dark themes.

## Implementation

1. Add a red deterministic contrast test over all 24 issuer tint colors and
   the actual source-host foreground.
2. Replace the general muted light-theme foreground with a tint-safe token or
   explicit utility while preserving a suitable dark-theme color.
3. Keep source label, hostname value, href filtering, keyboard focus, and
   external-link security attributes unchanged.
4. Add/update component source-contract coverage for the dedicated host style.

## Acceptance

- [x] Source-host text reaches at least 4.5:1 on every supported tint.
- [x] Light and dark themes remain readable.
- [x] The visible hostname and accessible link name remain truthful.
- [x] Unsafe URLs remain hidden and external-link protections remain intact.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual red→implement→contrast-matrix→repository-gates fallback. No deployment
is permitted.

## Completion evidence

- Red: the complete issuer-tint matrix reproduced sub-AA light-theme pairs.
- Green: all 24 issuer tints pass in both themes; independent computation
  measured a worst case of 7.53:1 in light mode and 5.11:1 in dark mode.
- Commit:
  `ca4a9cd041bb93b8280f911a2d5476770624601a`
  (`♿ fix(web): raise source host contrast`).
