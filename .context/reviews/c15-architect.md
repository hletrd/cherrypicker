# Cycle 15 — Architecture Review

**Date:** 2026-05-06
**Scope:** Architectural risks, coupling, layering, module boundaries.

## Findings

### C15-ARCH01: Parser duplication (web vs server) remains unaddressed (MEDIUM — carry-over)
- **Files:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Issue:** The D-01 deferred item (parser duplication) is still present. Cycle 14 fixes had to be applied in BOTH locations (date-utils.ts, adapter-factory.ts). This creates maintenance burden and parity risk.
- **Status:** Deferred as major refactor. No new action recommended in this cycle.
- **Confidence:** High

### C15-ARCH02: Reward calculator dual-branch ambiguity (MEDIUM)
- **File:** `packages/core/src/calculator/reward.ts:261`
- **Issue:** The "both rate and fixedAmount" branch has unclear semantics. The code silently prefers rate over fixed, but there's no design documentation explaining why. If Korean card rules genuinely never combine them, the YAML schema should enforce this at validation time (Zod schema), not silently drop data at calculation time.
- **Fix:** Add a Zod validation in `packages/rules/src/schema.ts` that rejects tiers with both `rate` and `fixedAmount` present. This moves the constraint from runtime ambiguity to schema-level clarity.
- **Confidence:** High

### C15-ARCH03: Analyzer.ts mixes parsing, categorization, and optimization (LOW — carry-over)
- **File:** `apps/web/src/lib/analyzer.ts`
- **Issue:** The analyzer combines file parsing, merchant categorization, and card optimization in a single module. While currently manageable (~270 lines), this coupling makes it harder to test individual concerns in isolation.
- **Status:** Deferred (D-34). No new action.
- **Confidence:** Medium

## No New Major Architectural Risks
