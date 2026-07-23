# Cycle 2 — Debugger

**Review target:** `a9d3c99d52dcacd6e48eede07bb7208af4acb7a2`
**Lens:** concrete failure sequences, asynchronous interleavings, stale state, and error-path observability.

## Inventory and coverage

The debugger sweep used the complete **1,041-file** relevant inventory shared by this Cycle 2 lane: root/config/docs 15, web 115, E2E 9, core 29, parser 75, rules code/registries/tests 22, all 707 card-source files, viz 8, scripts 16, CLI 13, and scraper 32. Historical review material and build/cache output were excluded; all catalog data was covered through exhaustive validators and queries.

## Finding

### C2-D-001 — A stale `reoptimize()` can overwrite a newer analysis or reset

- **Severity:** High
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `apps/web/src/lib/store.svelte.ts:333-389,391-485`; caller `apps/web/src/components/dashboard/TransactionReview.svelte:204-217`
- **Failure sequence:**
  1. Result A is present and category edits start `reoptimize(A-edited)`.
  2. `reoptimize()` snapshots A, then awaits category loading and optimizer loading/work.
  3. During either await, the user starts and completes analysis B, cancels analysis, or resets the store.
  4. The older reoptimization resumes and unconditionally assigns `{ ...snapshotA, ... }` at `:447-461`, persists it, increments generation, and finally sets `loading = false`.
- **Evidence:** `analyze()` has an `analysisRequestId` latest-request guard, but `reoptimize()` neither captures nor advances it and performs no generation/current-result check after its awaits. `reset()` also does not invalidate reoptimization. The snapshot prevents mixed reads, but guarantees that the eventual stale write is wholly based on A. The shared loading/error fields can also be cleared by the stale operation while B is active.
- **Suggested fix:** Use one mutation epoch/request owner across analyze, cancel, reset, and reoptimize. Capture both epoch and source-result identity at reoptimization start; after every await and before error/loading/result/persistence commits, require that it is still current. Increment the epoch on reset/cancel/new analysis/new reoptimization. Add deferred-promise tests for A reoptimize → B analyze, A reoptimize → reset, and two reoptimizations completing in reverse order.

## Verification and final missed-issue sweep

- Full suite: **2,196 passed / 0 failed** on installed Bun 1.3.12; the repo's release pin is Bun 1.2.6.
- Focused suite: **194 passed / 0 failed**.
- Manual interleaving review covered shared fetch promises, abort ownership, file-queue generations, navigation timers, persistence commits, analyzer module loading, category cache initialization, and store resets.
- Error-path probes covered generic-vs-targeted parser errors, invalid-date retention, remote partial success, non-finite catalog values, and unsupported-issue attribution. C2-D-001 is the only additional debugger finding that met the evidence threshold.
