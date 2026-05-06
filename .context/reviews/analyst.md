# Analyst Review — CherryPicker (Cycle 32)

**Reviewer:** analyst (self-completed after agent timeout)
**Scope:** Requirements clarity, data-model consistency, architectural risk, cross-package dependency analysis
**Date:** 2026-05-06

---

## Summary

Four structural concerns identified. The most significant is a requirements-to-implementation gap: `excludeOnline` is surfaced in the rule schema and UI but has no backend wiring. Three additional risks concern parser parity, optimizer scalability, and type-safety degradation.

---

## Structural Concerns

### AN-01: `excludeOnline` — Requirements Gap [HIGH]

**Confidence:** High
**Files:** `packages/rules/data/cards/*.yaml` (schema), `packages/core/src/calculator/reward.ts:36-51`, `apps/web/src/lib/parser/types.ts`

The card rule YAML schema supports `excludeOnline: true`. The web app renders this condition in card detail views. However, `RawTransaction` lacks an `isOnline` field, and the categorizer never sets it. `reward.ts:36-51` evaluates `excludeOnline && tx.isOnline`, which is always false.

**Impact:** Users see "offline only" card recommendations that incorrectly include online transactions. The optimizer overestimates rewards.

**Options:**
- (A) Remove `excludeOnline` from schema, YAML files, and UI — smallest scope, honest about current capability.
- (B) Implement online-merchant detection (regex on merchant name for patterns like "배달", "온라인", "쿠팡") and wire through parser → categorizer → optimizer — larger scope, enables the feature.

**Recommendation:** Option A for immediate correctness; Option B can be a follow-up feature request.

---

### AN-02: Parser Parity — Web vs Server Feature Gaps [MEDIUM]

**Confidence:** High
**Files:** `apps/web/src/lib/parser/index.ts:26-62`, `packages/parser/src/detect.ts:9-47`, `apps/web/src/lib/parser/ofx.ts:136-144`, `packages/parser/src/ofx/index.ts:108-114`

Two parity gaps exist between web and server parsers:
1. **Encoding:** Server detects UTF-16 LE/BE; web does not.
2. **OFX amounts:** Server uses minimal `parseOFXAmount` (no full-width support); web uses rich `parseAmountString`.

The project claims "web-side parity" in commit messages (C98, C99), but these gaps remain.

**Impact:** Users uploading UTF-16 or full-width OFX files on the web get different (worse) results than if they used the server CLI.

**Fix:** Extract shared encoding detection and amount normalization into `packages/parser/src/shared/` and consume from both web and server entry points.

---

### AN-03: Greedy Optimizer Quadratic Complexity [MEDIUM]

**Confidence:** High
**Files:** `packages/core/src/optimizer/greedy.ts:39-66`, `packages/core/src/optimizer/greedy.ts:198-233`

The greedy optimizer recalculates total rewards from scratch for every card candidate on every transaction. Complexity is O(T² · C). For 1000 transactions and 100 cards, this approaches 100M inner-loop iterations.

**Impact:** Browser UI freeze on large datasets. No progress indicator or Web Worker offload.

**Fix:** Incremental reward calculation. The marginal reward of adding a transaction to a card depends only on:
- the card's reward function (fixed per card)
- the current totals for that card (running sums)

Memoizing `calculateRewards` per card state reduces complexity to O(T · C).

---

### AN-04: Type-Safety Degradation in Persistence Layer [MEDIUM]

**Confidence:** High
**Files:** `apps/web/src/lib/store.svelte.ts:223,267,287,328`

Four `as Record<string, unknown>` casts in `store.svelte.ts` indicate the persistence layer is deserializing JSON without schema validation. If the stored shape changes (e.g., after a schema migration), the casts produce runtime `undefined` values that propagate silently.

**Impact:** Hard-to-debug crashes after app updates. Users may lose analysis state on refresh.

**Fix:** Add a Zod schema for the `AnalysisSnapshot` and validate with `.safeParse()` before hydration. Reject invalid snapshots and fall back to a fresh analysis.

---

## Dependency Analysis

| Package | External Deps | Risk |
|---------|---------------|------|
| packages/core | None | Low — pure TS, no runtime lock-in |
| packages/parser | `bun` (server), none (web shared) | Medium — web parsers duplicated instead of shared |
| packages/rules | `yaml`, `zod` | Low — stable, well-maintained |
| packages/viz | None | Low — pure TS |
| apps/web | Astro, Svelte, Tailwind, D3, xlsx | Medium — frontend framework churn risk |
| tools/cli | `bun` | Low |
| tools/scraper | `anthropic` SDK | Low — API-only, no binary deps |

**Observation:** The monorepo correctly isolates runtime-specific code (web vs Bun), but the web/parser duplication violates the DRY principle and creates parity drift.

---

## Verdict

**HIGHEST PRIORITY:** AN-01 (excludeOnline gap) — user-visible incorrect optimization.
**NEXT:** AN-02 (parser parity) and AN-03 (optimizer scalability) — correctness and performance.
**NEXT:** AN-04 (persistence validation) — reliability.
