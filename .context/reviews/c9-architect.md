# Cycle 9 — Architect

## C9-A01: Systemic hardcoded-taxonomy-duplicate pattern now at 7 instances
- **Severity:** MEDIUM (architectural)
- **Confidence:** High
- **Files:**
  - `packages/core/src/optimizer/greedy.ts:11-90` — CATEGORY_NAMES_KO
  - `apps/web/src/lib/category-labels.ts:32-110` — FALLBACK_CATEGORY_LABELS
  - `apps/web/src/components/dashboard/TransactionReview.svelte:26-42` — FALLBACK_GROUPS
  - `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87` — CATEGORY_COLORS
  - `apps/web/src/lib/formatters.ts:52-79` — formatIssuerNameKo
  - `apps/web/src/lib/formatters.ts:85-110` — getCategoryIconName
  - `apps/web/src/lib/formatters.ts:115-143` — getIssuerColor
- **Description:** The codebase now has 7 hardcoded maps that duplicate taxonomy or issuer data. Each must be updated in lockstep when the source data changes. The critic noted this as a 5th recurrence in cycle 8; cycle 9 reveals 2 more instances. This is a structural problem that cannot be solved by fixing individual maps — a build-time generation step is needed.
- **Fix:** Create a build-time script that reads `categories.yaml` and `cards.json` and generates:
  1. Category label maps (Korean, with dot-notation keys)
  2. Category color assignments (deterministic hash-based with manual overrides)
  3. Category icon assignments
  4. Issuer name/color maps
  Fallback maps should be auto-generated, not handwritten. This resolves C7-01, C7-02, C8-01, C9-CR01, C9-CR03, C9-CR04, C9-CR06 together.

## C9-A02: FileDropzone ALL_BANKS duplicates parser bank signatures
- **Severity:** LOW
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:80-105`
- **Description:** The ALL_BANKS list duplicates the bank IDs in detect.ts. If the parser adds a new bank, the UI won't offer it as a manual selection option. This is a cross-layer consistency risk.
- **Fix:** Generate the bank list from a shared source at build time, or export the bank signatures from the parser package.

## C9-A03: Web parser mirrors packages/parser with divergent implementations
- **Severity:** MEDIUM (architectural, previously deferred as D-01)
- **Description:** `apps/web/src/lib/parser/` contains browser-compatible parser implementations (csv.ts, detect.ts, date-utils.ts, xlsx.ts, pdf.ts) that mirror `packages/parser/src/` but run in the browser without Bun/Node APIs. This is a known deferred item (D-01). Not re-reported as a new finding, but noted for completeness — the divergence continues to grow.
