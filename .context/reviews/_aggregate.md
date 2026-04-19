# Review Aggregate — 2026-04-19 (Cycle 18)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle18-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-17 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-17 findings have been verified as fixed or deferred. Cycle 17 findings C17-01 through C17-14 are confirmed fixed in the codebase.

Deferred items D-01 through D-103 remain unchanged and are not re-listed here.

---

## Verification of Cycle 17 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C17-01 | FIXED | `pdf.ts:180-185` — returns 0 instead of NaN |
| C17-03 | FIXED | `reward.ts:183-193` — warns when no tier matched |
| C17-11 | FIXED | `matcher.ts:27-28,91-95` — knownCategories validates rawCategory |
| C17-07 | FIXED | `ilp.ts:48` — downgraded to console.debug |
| C17-02 | FIXED | `pdf.ts:316-318` — g-flag safety comment added |
| C17-09 | FIXED | `greedy.ts:156-162` — rate source comment added |
| C17-12 | FIXED | `playwright.config.ts` — switched to preview server |

---

## Active Findings (New in Cycle 18, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C18-01 | HIGH | High | `FileDropzone.svelte:200` | Empty previousSpending string converts to 0 instead of undefined — tiered cards silently get 0 reward | New |
| C18-02 | MEDIUM | Medium | `TransactionReview.svelte:52-65` | Dropdown has duplicate option values for categories existing as both parent and subcategory | New |
| C18-03 | LOW | High | `CardDetail.svelte:50-55` | Unnecessary globalConstraints type cast loses type safety | New |
| C18-04 | LOW | Medium | `taxonomy.ts:68-76` | Substring search has no minimum keyword length guard unlike MerchantMatcher | New |

---

## Cross-Agent Agreement (Cycle 18)

Single comprehensive review this cycle — no cross-agent duplication to resolve.

---

## Prioritized Action Items

### CRITICAL (must fix)
1. C18-01: Fix empty previousSpending conversion — `Number('')` returns 0 instead of NaN, causing tiered cards to silently produce 0 reward for single-file uploads. This is a user-facing correctness bug.

### HIGH (should fix this cycle)
2. C18-02: Fix TransactionReview dropdown duplicate option values — use fully-qualified subcategory IDs

### MEDIUM (plan for next cycles)
- C18-03 (remove unnecessary type cast)
- C18-04 (add minimum keyword length guard to taxonomy)

### LOW (defer or accept)
- None new this cycle

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
