# Review Aggregate — 2026-04-19 (Cycle 17)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle17-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-16 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-16 findings have been verified as fixed or deferred. Cycle 16 findings C16-01 through C16-09 are confirmed fixed in the codebase.

Deferred items D-01 through D-103 remain unchanged and are not re-listed here.

---

## Verification of Cycle 16 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C16-01 | FIXED | `analyzer.ts:156-167` — cache stores full rules, cardIds filter applied after retrieval |
| C16-02 | MOOT | `constraints.ts` — categorySpending removed |
| C16-03 | FIXED | `constraints.ts` — categorySpending removed from interface |
| C16-04 | FIXED | Same — dead code removed |
| C16-05 | DEFERRED | Same as D-09/D-100 |
| C16-06 | FIXED | `index.astro:7-9` now 683/24/45 |
| C16-07 | DEFERRED | Same as D-101 |
| C16-08 | FIXED | `index.ts:18` re-exports buildCategoryKey |
| C16-09 | FIXED | `cards.ts:6-12` uses WebRewardConditions |

---

## Active Findings (New in Cycle 17, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C17-01 | MEDIUM | High | `pdf.ts:180-183` | `parseAmount` returns NaN instead of 0 for unparseable inputs — fragile API contract, NaN could silently propagate | New |
| C17-03 | MEDIUM | High | `reward.ts:176-195` | No performance tier matched (`tierId === 'none'`) → all rewards skipped silently, 0 reward for CLI users with 0 previous spending | New |
| C17-11 | MEDIUM | Medium | `matcher.ts:84-87` | rawCategory normalization doesn't validate against taxonomy — Korean text categories become phantom categories with 0 reward | New |
| C17-07 | LOW | High | `ilp.ts:48` | ILP stub always warns on console — public API that always warns is misleading | New |
| C17-02 | LOW | High | `pdf.ts:313` | `fallbackAmountPattern` `g` flag — safe as local var but dangerous if hoisted | Extends D-83 |
| C17-08 | LOW | High | `reward.ts:197-213` | Bucket mutated before set — fragile pattern (same as D-87) | Extends D-87 |
| C17-09 | LOW | Medium | `greedy.ts:158-166` | Rate source inconsistency between first and subsequent transactions | New |
| C17-12 | LOW | Medium | `playwright.config.ts:17` | E2E tests use dev server, not production build | New |
| C17-13 | LOW | Medium | `FileDropzone.svelte:200` | Number input iOS Safari exponential notation risk (same class as D-28) | Extends D-28 |
| C17-14 | LOW | Medium | `greedy.ts:204-241` | Per-card totalReward vs sum of marginal rewards may differ due to floor rounding | New |

---

## Cross-Agent Agreement (Cycle 17)

Single comprehensive review this cycle — no cross-agent duplication to resolve.

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C17-01: Fix `parseAmount` to return 0 instead of NaN — eliminates an entire class of potential NaN propagation bugs
2. C17-03: Add warning when no performance tier is matched in `calculateRewards` — prevents silent 0 reward for CLI/standalone usage
3. C17-11: Validate rawCategory normalization against taxonomy — prevents phantom categories from Korean bank category text

### MEDIUM (plan for next cycles)
- C17-07 (ILP stub console.warn — remove or downgrade)
- C17-12 (E2E dev server vs production — config change)

### LOW (defer or accept)
- C17-02 (g flag comment — extends D-83), C17-08 (bucket mutation — extends D-87), C17-09 (rate source — cosmetic), C17-13 (iOS number — extends D-28), C17-14 (rounding display — acceptable)

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
