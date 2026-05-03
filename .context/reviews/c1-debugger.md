# Cycle 1 (fresh) — debugger pass

**Date:** 2026-05-03

## Scope

Latent bug surface, failure modes, regressions.

## Findings

### C1-D01: `inferYear` timezone edge case near midnight on Dec 31

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/date-utils.ts:35-43`
- **Description:** Known limitation (C8-08). `new Date()` is timezone-dependent. Near midnight on Dec 31 in UTC-X timezones, the year may already have rolled over. Narrow edge case (minutes around midnight, once per year).
- **Status:** Known limitation, documented. Not actionable.

### C1-D02: `detectBank` can misidentify bank when transaction text contains another bank's keyword

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/detect.ts:127-164`
- **Description:** Bank detection scans entire file content. If a statement from bank A contains bank B's name in a merchant description, both banks score 1+. Tie-breaking favors first in BANK_SIGNATURES. Partially mitigated by C70-01 fix. User can override via bank selector.
- **Status:** Known limitation, partially mitigated, user override available.

## Summary

2 findings (both LOW, both known limitations). No new latent bugs discovered.
