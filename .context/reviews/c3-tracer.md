# Cycle 3 — Tracer

**Date:** 2026-04-24
**Reviewer:** tracer
**Scope:** Full repository — causal tracing of suspicious flows

---

## C3-TR01: Duplicate keyword shadow flow — `SHAKE SHACK KOREA` in merged ALL_KEYWORDS

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/matcher.ts:8-13`, `packages/core/src/categorizer/keywords.ts:9187`, `packages/core/src/categorizer/keywords-english.ts:108`
- **Description:** Traced the data flow for a transaction with merchant "SHAKE SHACK KOREA":
  1. `MerchantMatcher.match()` is called
  2. Line 47: `ALL_KEYWORDS[lower]` — exact match lookup against the merged map
  3. The merged map is built by `{...MERCHANT_KEYWORDS, ...ENGLISH_KEYWORDS, ...}` (line 9-12)
  4. Since `SHAKE SHACK KOREA` exists in both MERCHANT_KEYWORDS and ENGLISH_KEYWORDS, the ENGLISH_KEYWORDS value overwrites the MERCHANT_KEYWORDS value during spread
  5. Both values are `'dining.fast_food'`, so the behavior is correct today
  6. But if either entry is changed independently, the other becomes a silent shadow — the developer sees their entry in the source file and assumes it's active, but it's actually being overwritten
- **Competing hypotheses:**
  - H1: The duplicate is intentional (belt-and-suspenders approach) — LOW probability, because no comment documents this intent
  - H2: The duplicate is an oversight from adding English keywords without checking for existing entries — HIGH probability
- **Fix:** Remove duplicate from keywords-english.ts. Add a build-time or test-time check for duplicate keys across keyword files.

---

## Final Sweep

Traced the critical data flows: statement upload -> parse -> categorize -> optimize -> display. The categorization flow through the merged keyword map (C3-TR01) is the most interesting trace result. The optimization flow through greedy.ts is well-understood from prior cycles. The sessionStorage persistence flow has been hardened through multiple prior fixes (C22-03, C74-02, C75-03, C76-01).
