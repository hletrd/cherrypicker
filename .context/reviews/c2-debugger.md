# Cycle 2 — debugger pass

**Date:** 2026-05-03

## Scope

Latent bug surface, failure modes, regressions.

## Findings

### C2-D01: `inferYear` timezone edge case near midnight on Dec 31 (re-confirmed from C1-D01)

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/date-utils.ts:35-43`, `packages/parser/src/date-utils.ts:25-31`
- **Description:** Known limitation (C8-08). `new Date()` is timezone-dependent. Narrow edge case.
- **Status:** Known limitation, documented. Not actionable.

### C2-D02: `detectBank` can misidentify bank (re-confirmed from C1-D02)

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/lib/parser/detect.ts:127-164`, `packages/parser/src/detect.ts:109-146`
- **Description:** Bank detection scans entire file content. Tie-breaking favors first in BANK_SIGNATURES. User can override via bank selector.
- **Status:** Known limitation, partially mitigated, user override available.

### C2-D03: `loadFromStorage` outer catch block swallows initial error silently

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/store.svelte.ts:324`
- **Description:** The outer `catch {}` in `loadFromStorage` at line 324 has no diagnostic logging. When `sessionStorage.getItem` or `JSON.parse` throws (e.g., SecurityError in sandboxed iframes), the error is silently swallowed. The inner nested catch at line 325 only handles the `removeItem` failure case — it doesn't log what the original error was.
- **Fix:** Add a `console.warn` in the outer catch to log the original error before attempting cleanup.

## Summary

1 net-new finding (C2-D03, LOW). 2 re-confirmations of known limitations.
