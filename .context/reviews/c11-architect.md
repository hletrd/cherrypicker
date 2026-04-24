# Cycle 11 — Architect

Date: 2026-04-24

## Findings

### C11-A01: Seven+ hardcoded taxonomy/issuer data duplicates remain the highest-leverage architectural debt
- **Files:** `packages/core/src/optimizer/greedy.ts:11-90`, `apps/web/src/lib/category-labels.ts:32-110`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87`, `apps/web/src/components/dashboard/TransactionReview.svelte:26-42`, `apps/web/src/components/upload/FileDropzone.svelte:80-105`, `apps/web/src/lib/formatters.ts:52-78,86-110,115-143`
- **Severity:** MEDIUM (structural, not blocking)
- **Confidence:** High
- **Description:** The same category labels, colors, issuer names, bank IDs, and icon mappings are hardcoded in 7+ locations. This is the most impactful improvement opportunity: a build-time code generation step from `categories.yaml` and `cards.json` that produces TypeScript modules with all fallback data, label maps, color maps, and icon mappings. This would eliminate an entire class of drift bugs.
- **Exit criterion:** Build-time generation from YAML/JSON sources.

### C11-A02: Web parser duplicates server parser (D-01) — no change
- **Severity:** HIGH (architectural, deferred)
- **Confidence:** High
- **Description:** `apps/web/src/lib/parser/` duplicates `packages/parser/src/` with browser-compatible re-implementations. The web parsers cannot use Bun/Node APIs. This is the largest known architectural debt item but requires careful design to avoid breaking either environment.
- **Exit criterion:** D-01 refactor cycle with design doc.

## Convergence

- All 11 review angles converge on the same top-leverage improvement: build-time generation to eliminate hardcoded duplicates.
- The core package architecture (`core` → `rules` → `parser`) has clean layering with no circular dependencies.
- The web app's Svelte 5 store pattern (`store.svelte.ts`) is well-structured with proper lifecycle management.

## Final sweep

Package dependency graph: `apps/web` → `packages/core` → `packages/rules`, `apps/web` → `packages/parser` (via Bun-only path, not used at runtime). No circular dependencies. No layer violations detected.
