# Code Review — cherrypicker (Cycle 6)

**Reviewer:** code-reviewer
**Scope:** Changes since Cycle 5 (commits e8351ee, f7adfe8, ce91407, 41fb34c, 87aa83a)
**Date:** 2026-05-06

---

## Summary

Cycle 6 addressed 2 of 6 critical findings from Cycle 5 (CATEGORY_NAMES_KO hardcoding, LLM consent flow). The ParseError class refactor, LRU cache, and path validation are well-implemented. However, a new HIGH-severity data integrity bug was introduced in the JSON parser, and web-side parser parity remains incomplete.

---

## Verified Fixed (Cycle 5 → Cycle 6)

| Finding | Commit | Evidence |
|---------|--------|----------|
| CATEGORY_NAMES_KO hardcoded | e8351ee | `greedy.ts` no longer contains inline labels; `categoryLabels` is required parameter |
| LLM fallback without consent | 41fb34c | `requireRemoteLLMConsent()` enforces `--allow-remote-llm` with interactive prompt |
| MerchantMatcher O(n*m) scan | f7adfe8 | LRU cache added with 500-entry cap, O(1) lookup on cache hits |
| Parser errors lack context | 87aa83a | `ParseError` class with `file`, `format`, `line`, `raw` fields; `enrichErrors()` backfills |
| Path traversal in CLI | ce91407 | `validateFilePath()` rejects `..` segments and verifies existence |

---

## New Findings (Cycle 6)

### [C6-01-HIGH] JSON parser silently converts refunds to purchases via `Math.abs`

**File:** `packages/parser/src/json/index.ts:116`
**Confidence:** High

```ts
const absAmount = Math.abs(amount);
```

The JSON parser takes the absolute value of negative amounts, converting refunds (negative values) into positive purchases. This corrupts transaction data silently. The comment claims this "accepts negative amounts (refunds/credits) by taking absolute value," but the opposite happens — the negative sign is discarded entirely.

**Failure scenario:** A user exports refund transactions from their banking API as negative amounts. The JSON parser makes them positive, causing the optimizer to treat refunds as additional spending. This inflates total spending and may push the user into a higher performance tier with worse rewards.

**Fix:** Remove `Math.abs()`. Treat negative amounts as refunds (skip them in optimization, as the optimizer already filters `amount <= 0` at `greedy.ts:204`). Update the comment to accurately describe the behavior.

```ts
// Refunds (negative amounts) are preserved in RawTransaction but skipped
// by the optimizer's positive-only filter.
if (amount < 0) {
  tx.amount = amount; // preserve negative for transparency
} else {
  tx.amount = amount;
}
```

Or simply: `tx.amount = amount;` without Math.abs, since the optimizer already filters.

---

### [C6-02-HIGH] Web-side ParseError remains plain interface, breaking parity with server-side class

**Files:** `apps/web/src/lib/parser/types.ts:30-34` vs `packages/parser/src/types.ts:30-47`
**Confidence:** High

Server-side `ParseError` is now a `class extends Error` with optional context fields. Web-side `ParseError` is still a plain `interface` with `message`, `line`, `raw` only (no `file`, `no format`, no `instanceof` compatibility).

This creates a type-system and runtime parity gap:
- Web-side errors cannot be enriched with `file`/`format` context
- `instanceof ParseError` checks in `enrichErrors()` will fail for web-side errors
- Error reporting in the web UI lacks file/format context that the server CLI now provides

**Fix:** Align web-side `types.ts` with server-side: define `ParseError` as a class, add `file` and `format` optional fields, and update all web parsers to construct instances instead of plain objects.

---

### [C6-03-MEDIUM] `categoryLabels` building logic duplicated across 5+ call sites

**Files:** `tools/cli/src/commands/analyze.ts:88-97`, `tools/cli/src/commands/optimize.ts:95-104`, `tools/cli/src/commands/report.ts` (similar), `packages/viz/src/terminal/summary.ts`, `apps/web/src/lib/analyzer.ts:242-247`
**Confidence:** High

The same 8-line block for building `Map<string, string>` from category nodes is copy-pasted in at least 5 locations. This is the same pattern that led to the CATEGORY_NAMES_KO hardcoding problem — when taxonomy structure changes, every call site must be updated.

**Fix:** Extract a shared utility (e.g., `buildCategoryLabelMap(nodes): Map<string, string>`) in `packages/rules/src/category-names.ts` or a new shared package. Import from all call sites.

---

### [C6-04-MEDIUM] Outdated Anthropic model name still hardcoded

**File:** `packages/parser/src/pdf/llm-fallback.ts:50`
**Confidence:** High

```ts
const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6';
```

The default model name `claude-sonnet-4-6` is outdated. Current Anthropic API uses `claude-sonnet-4-7-20251001` or similar. Users without `ANTHROPIC_MODEL` env var will call a non-existent model.

**Fix:** Update default to a current stable model (e.g., `claude-sonnet-4-7-20251001`) or add runtime validation that rejects unknown model names with a helpful error.

---

### [C6-05-LOW] `parse-error.test.ts` structural test is vacuous

**File:** `packages/parser/__tests__/parse-error.test.ts:34-43`
**Confidence:** High

```ts
test('used by at least 3 parsers (OFX, HTML, JSON)', () => {
  const ofx = import('../src/ofx/index.js');
  const html = import('../src/html/index.js');
  const json = import('../src/json/index.js');
  expect(ofx).toBeDefined();
  expect(html).toBeDefined();
  expect(json).toBeDefined();
});
```

This test only verifies that dynamic imports resolve — it does NOT verify that the parsers actually construct `ParseError` instances. A parser could import `ParseError` but never use it, and this test would still pass.

**Fix:** Replace with a real structural test: parse malformed content through each parser and assert `instanceof ParseError` on returned errors. Or use AST search to verify `new ParseError(...)` appears in each parser source.

---

### [C6-06-LOW] Consent prompt hardcoded in English

**File:** `tools/cli/src/consent.ts:23`
**Confidence:** Medium

```ts
rl.question('This will send up to 8000 chars to Anthropic. Continue? (y/N) ', ...)
```

The interactive prompt is in English while all other CLI messages are Korean. This is inconsistent UX for Korean users.

**Fix:** Localize the prompt to Korean:
```ts
rl.question('PDF 파싱을 위해 최대 8000자의 데이터가 Anthropic API로 전송됩니다. 계속하시겠습니까? (y/N) ', ...)
```

---

## Still Open from Cycle 5

| ID | Description | Status |
|----|-------------|--------|
| C-CR-01 | Non-KRW transactions silently dropped | **OPEN** |
| F-CRI-01 | Server/web parser duplication | **OPEN** (partially mitigated by parity comments) |
| A-ARCH-01 | Parser duplication — no shared core | **OPEN** |
| C-CR-05 | Outdated Anthropic model name | **OPEN** (C6-04) |
| S-SEC-02 | HTML `esc()` incomplete | **OPEN** |
| C-CR-04 | Web app redefines CardRuleSet inline | **OPEN** |
