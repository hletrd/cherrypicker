# Cycle 1 (fresh) — perf-reviewer pass

**Date:** 2026-05-03

## Scope

Performance, concurrency, CPU/memory/UI responsiveness.

## Findings

### C1-P01: XLSX parser creates a full `TextEncoder().encode()` copy of HTML content

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/xlsx.ts:299`
- **Description:** When HTML-as-XLS is detected, the full decoded HTML string is re-encoded via `new TextEncoder().encode(html)` to produce a `Uint8Array` for `XLSX.read()`. This creates a second full copy of the file content in memory. For a 10 MB HTML file (the per-file upload limit), this means ~30 MB peak memory.
- **Fix:** Pass the HTML string directly to XLSX using `XLSX.read(html, { type: 'string' })` which avoids the re-encoding.

### C1-P02: Build produces chunk > 500 KB warning

- **Severity:** LOW
- **Confidence:** High
- **File+line:** Vite build output
- **Description:** The Astro build produces a warning: "Some chunks are larger than 500 kB after minification." The xlsx library is likely the primary contributor.
- **Fix:** Consider code-splitting the XLSX parser via dynamic import (already partially done for PDF).

## Summary

2 net-new perf findings (both LOW).
