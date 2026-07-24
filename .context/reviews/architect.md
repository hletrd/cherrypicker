# Current architecture review — Cycle 19

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Role: boundaries, ownership, coupling, layering, and architectural drift
- Disposition: one genuinely new Low-severity, High-confidence finding
- Detailed immutable report:
  `.context/reviews/2026-07-24-cycle19-architect.md`

## Complete inventory

All 2,409 tracked paths were classified before inspection: 362 source/test
paths, 739 rule and publication-data paths, 1,237 historical review/plan
paths, and 71 manifests, configs, docs, workflow files, fixtures, and other
assets. The architecture pass covered package exports and dependency
direction, runtime-specific imports, domain and DTO ownership, generated
source/publication boundaries, workers and caches, persistence, output sinks,
network/filesystem services, CI authority, and the full Cycle 18 delta.

## C19-A-001 — a partial domain operation leaks through total validation APIs

- Severity: Low
- Confidence: High
- Partial domain operation:
  `packages/core/src/analysis/context.ts:96-109`
- Total boolean boundary:
  `apps/web/src/lib/analysis-result.ts:893-981,988-1095`
- Total persistence boundary:
  `apps/web/src/lib/persistence.ts:677-708,720-742,822-915`
- Last-resort store recovery:
  `apps/web/src/lib/store.svelte.ts:117-148`

The `YearMonth` domain correctly permits `0000-01`, while predecessor
construction correctly rejects it because the representable four-digit domain
has no earlier month. That makes `previousCalendarMonth()` intentionally
partial. Two older architectural boundaries still model their downstream
validation as total:

- coherence is a boolean predicate whose invalid-data answer should be
  `false`; and
- persistence deserialization returns a discriminated invalid/corrupted
  result.

A structurally valid truncated current-v4 snapshot at `0000-01` crosses both
boundaries as a `RangeError`. The store's broader recovery catch prevents a
route crash, but conflates deterministic invalid data with storage access.
Direct consumers of the exported boundaries receive the exception.

The architectural repair belongs at the abstraction boundaries, not in the
domain primitive: keep the helper throw, convert the unrepresentable
predecessor to `false` in coherence, and add a defensive exception-to-invalid
translation in deserialization. Tests should preserve the distinct contracts.

Normal parsers constrain statement years to 1900–2100, limiting this to
constructed, tampered, or stale persisted state and keeping severity Low.
Historical review found ownership for direct underflow in Plan 148, but none
for the exception crossing the total validation interfaces.

## Other boundary conclusions

Catalog generation now establishes a complete identity before injecting it
into projection-specific schemas. `.mts` / `.cts` discovery derives from the
same extension authority across source and top-level config paths. Package
dependency direction, parser/worker ownership, catalog cache generations,
viz output sinks, and scraper service boundaries remain coherent. Known
parser duplication, optimizer complexity, matcher scale, static-host CSP,
session storage, and compatibility artifacts retain historical owners.

## Verification and disposition

Dependency ownership, type checking, workspace/script tests, the full Vitest
suite, and bundle/publication budgets passed. No browser, Chrome, E2E,
deployment, source, plan, or generated artifact mutation occurred. The final
boundary sweep found no second novel architectural root.

Final new architecture finding count: **1**.
