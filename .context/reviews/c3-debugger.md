# Cycle 3 — Debugger

**Date:** 2026-04-24
**Reviewer:** debugger
**Scope:** Full repository

---

## C3-D01: `calculateRewards` bucket mutation before Map.set creates subtle data-loss risk

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/core/src/calculator/reward.ts:232-248`
- **Description:** Same as C3-CR02 from code-reviewer perspective. The bucket object is created via `??` fallback, then mutated (`bucket.spending += tx.amount` at line 244), then potentially stored via `categoryRewards.set()`. The mutation-before-set ordering is fragile. If a `continue` or `return` is added between lines 244 and the next `set()` call, the spending accumulation would be lost. Currently, the code paths all eventually reach a `set()` call, but the pattern is error-prone for future maintenance.
- **Failure scenario:** Future code change inserts an early return between spending mutation and `categoryRewards.set()`, losing accumulated spending for that category.
- **Fix:** Always call `categoryRewards.set(categoryKey, bucket)` immediately after bucket creation, before any mutations.

## C3-D02: `parsePDFWithLLM` timeout controller may abort after client is already used

- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `packages/parser/src/pdf/llm-fallback.ts:51-52, 126-128`
- **Description:** The `AbortController` and its timeout are created at lines 51-52. The `controller.signal` is passed to the Anthropic client at line 66. The `finally` block at line 127 calls `clearTimeout(timeout)`, which correctly cleans up. However, if the `client.messages.create()` call has already completed and the response is being processed (lines 69-109), the timeout could theoretically fire during the synchronous JSON parsing at line 86, causing an abort exception. In practice, JSON parsing is near-instantaneous and the 30-second timeout is generous, making this a theoretical concern.
- **Failure scenario:** A very large LLM response takes > 30 seconds to parse, and the abort fires during JSON.parse, causing an uncaught exception.
- **Fix:** Move `clearTimeout(timeout)` to immediately after the `client.messages.create()` call completes (before response processing), rather than in the finally block.

---

## Final Sweep

No latent crash bugs, no data corruption paths, no unhandled error states found. The main latent risk is the bucket mutation pattern (C3-D01/C3-CR02) which is correct today but fragile for future maintenance.
