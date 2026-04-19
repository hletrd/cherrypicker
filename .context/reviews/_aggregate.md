# Review Aggregate — 2026-04-19 (Cycle 10)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle10-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-9 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-9 findings have been verified as fixed or deferred. Cycle 9 fixes (C9-01 through C9-13) are all correctly implemented. They are not re-listed here.

Deferred items D-01 through D-76 and LOW items from cycle 9 remain unchanged and are not re-listed here.

---

## Verification of Cycle 9 Fixes

All 5 implemented cycle 9 fixes verified as correctly implemented:
- C9-05: Error feedback when reoptimize discards edits due to null result
- C9-01: Fix `toCoreCardRuleSets` cache — remove reference equality check
- C9-11: Add non-empty string checks for critical fields in `isValidTx` validation
- C9-13: Explicitly sort `monthlyBreakdown` by month before rendering
- C9-03: Document bank detection tie-breaking behavior

---

## Active Findings (New in Cycle 10, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C10-01 | LOW | High | `reward.ts:265-268` | Global cap over-count correction is subtle — needs documentation | New |
| C10-02 | MEDIUM | High | `matcher.ts:46-55, taxonomy.ts:69-76` | Short merchant names (2 chars) falsely match longer keywords via `kw.includes(lower)` | New |
| C10-03 | LOW | Medium | `xlsx.ts:193-203` | `parseDateToISO` doesn't guard against `Infinity` from Excel formula errors | New |
| C10-04 | LOW | High | `CategoryBreakdown.svelte:87` | Subcategory color fallback goes to gray instead of parent category color | Extends D-42/D-46/D-64 |
| C10-05 | LOW | High | `greedy.ts:256-268` | bestSingleCard computation is O(n*m) — acceptable at current scale | Extends D-09/D-51 |
| C10-06 | MEDIUM | High | `FileDropzone.svelte:192-211` | `handleUpload` always sets `uploadStatus = 'success'` even when analysis fails | New |
| C10-07 | LOW | Medium | `OptimalCardMap.svelte:62` | `as const` type assertion works but fragile — maintainability note | New |
| C10-08 | LOW | High | `TransactionReview.svelte:6` | AI categorizer import is dead code | Duplicate of D-10/D-68 |
| C10-09 | MEDIUM | High | `analyzer.ts:266-271,293-311` | `reoptimize` includes all-month transactions but initial optimization uses only latest month | New |
| C10-10 | LOW | High | `SavingsComparison.svelte:174` | Annual savings projection * 12 is simplistic | Duplicate of D-40 |
| C10-11 | LOW | High | `detect.ts:8-105` | BANK_SIGNATURES patterns should not use `g` flag — latent risk note | New |
| C10-12 | MEDIUM | Medium | `store.svelte.ts:124-127` | SessionStorage truncation only omits transactions but optimization object can also be large | Extends D-48 |
| C10-13 | LOW | Medium | `matcher.ts:32-79` | Empty merchant name matches first keyword with 0.8 confidence | New |

---

## Cross-Agent Agreement (Cycle 10)

| Finding | Signal |
|---|---|
| C10-02 | NEW — independent discovery. Short merchant names matching via `kw.includes(lower)` is a genuine false-positive vector. Combined with the fact that `isSubstringSafeKeyword` only checks keyword length (not merchant length), this is a real issue. HIGH signal. |
| C10-06 | NEW — independent discovery. `handleUpload` always succeeds because `analysisStore.analyze()` catches errors internally. This is a UX bug — users get redirected to dashboard even on analysis failure. HIGH signal. |
| C10-09 | NEW — independent discovery. The discrepancy between initial optimization (latest month only) and reoptimize (all months) is a subtle but real consistency issue. HIGH signal. |
| C10-04 / D-42/D-46/D-64 | Same root cause (hardcoded color map). C10-04 identifies that subcategory lookups fall through to gray instead of parent category color. Combined signal is LOW (same class as existing deferred). |
| C10-08 / D-10/D-68 | Same finding (dead AI categorizer import). No new signal. |
| C10-10 / D-40 | Same finding (annual savings projection). No new signal. |
| C10-12 / D-48 | Related class (sessionStorage size limits). C10-12 adds that optimization object itself can be large. Combined signal is MEDIUM. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C10-06: Fix `handleUpload` to check `analysisStore.error` before setting success status
2. C10-09: Filter `reoptimize` transactions to latest month to match initial optimization behavior
3. C10-02: Add minimum merchant name length guard for `kw.includes(lower)` substring matching

### MEDIUM (plan for next cycles)
4. C10-12: Consider truncating `optimization.cardResults` when sessionStorage payload is still too large
5. C10-01: Add documentation comment for global cap over-count correction in `calculateRewards`

### LOW (defer or accept)
- C10-03, C10-04 (extends D-42), C10-05 (extends D-09), C10-07, C10-08 (dup of D-10), C10-10 (dup of D-40), C10-11, C10-13

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
