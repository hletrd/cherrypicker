# Documentation Review — Cycle 32

**Reviewer:** document-specialist (worker-9)
**Scope:** All documentation artifacts across the cherrypicker repository — README, inline comments, JSDoc, type annotations, code comments, configuration docs, and cross-file documentation consistency.
**Files examined:** 30+ source files, README.md, package.json, YAML data files, build scripts, CLI entry points, Svelte components, parser modules, core calculator/optimizer, and store modules.

---

## Summary

The codebase demonstrates **above-average documentation discipline** with extensive inline comments explaining rationale, cycle references (C##-##) linking fixes to past issues, and JSDoc on most exported functions. However, there are **critical accuracy gaps in the README**, stale tech-stack claims, missing documentation on several internal modules, and a documentation-maintenance burden from the cycle-reference convention that may itself become a liability.

| Category | Finding Count | Severity |
|---|---|---|
| README accuracy | 4 | High |
| Comment rot / stale refs | 3 | Medium |
| Missing JSDoc | 5 | Medium |
| Documentation mismatch | 2 | Medium |
| Over-documentation risk | 2 | Low |
| Positive findings | 4 | — |

---

## Confirmed Issues (High Confidence)

### 1. README.md: Stale "TypeScript 6" claim
**File:** `README.md:82`  
**Severity:** High  
**Confidence:** High

The README claims `| 언어 | TypeScript 6 |` in the tech stack table. The root `package.json` specifies `typescript: "^5.9.3"` and there is no TypeScript 6 release as of May 2026 (latest stable is 5.9.x). This is a factually incorrect claim that misleads contributors and users about the build toolchain.

**Suggested fix:** Change to `TypeScript 5.9` or simply `TypeScript`.

---

### 2. README.md: Card count inconsistency (561 vs 683)
**File:** `README.md:79` and `README.md:13-14`  
**Severity:** High  
**Confidence:** High

The README tech-stack table claims "561개 카드 규칙" but the badge on line 13 shows "Cards-683" and "Issuers-24". The `README.md:98` also says "561개" in the project structure section. The `build-json.ts` script dynamically counts cards from YAML files, so the actual number is whatever the build produces. This mismatch suggests the hardcoded "561" in the README is stale.

**Concrete failure:** A user reading the README expects 561 cards but the live app shows 683. Undermines trust.

**Suggested fix:** Replace hardcoded "561" with a dynamic reference or remove the count from the tech-stack table and rely on the badge.

---

### 3. README.md: "AI classification" wording contradicts actual state
**File:** `README.md:34, 48, 78`  
**Severity:** Medium  
**Confidence:** High

The README repeatedly states the AI classification feature is "비활성화 상태 (자체 호스팅 런타임 준비 중)" / "preparing self-hosted runtime". However, `apps/web/src/lib/categorizer-ai.ts` is a stub placeholder file with no actual implementation, and there is no active work visible in the codebase toward self-hosting an embedding model. The repeated mention gives the impression this is a temporary state rather than a permanently unimplemented feature.

**Suggested fix:** Either remove AI classification from the README entirely, or add a clear note that it is not on the current roadmap.

---

### 4. `cardMetaSchema.url` comment contradicts schema validation
**File:** `packages/rules/src/schema.ts:52-55`  
**Severity:** Medium  
**Confidence:** High

```typescript
// Keep runtime validation aligned with the generator lane: the catalog
// currently contains some issuer/card URLs that are useful as references
// but are not strict WHATWG-valid URLs.
url: z.string().optional(),
```

The comment explains WHY `url` is `z.string()` rather than `z.string().url()`, but the `cardMetaSchema` in `scripts/build-json.ts:65` uses `.optional().default('')` without the same explanatory comment. A future maintainer might "fix" the schema to use `.url()` in one place but not the other, creating a mismatch.

**Suggested fix:** Copy the explanatory comment to `scripts/build-json.ts` or extract a shared schema module.

---

### 5. Missing JSDoc on exported functions in `packages/rules/src/index.ts`
**File:** `packages/rules/src/index.ts`  
**Severity:** Medium  
**Confidence:** Medium

This is the public API entry point for the rules package, re-exporting ~25 types and functions. There is no module-level JSDoc explaining the package's purpose, no `@packageDocumentation` block, and no JSDoc on any export. Contributors must infer intent from schema names alone.

**Suggested fix:** Add a module-level `/** @packageDocumentation ... */` block and brief JSDoc on the loader exports (`loadCardRule`, `loadAllCardRules`, etc.).

---

### 6. `greedy.ts` internal functions undocumented
**File:** `packages/core/src/optimizer/greedy.ts`  
**Severity:** Medium  
**Confidence:** Medium

The module has a good JSDoc on `greedyOptimize` (lines 178-181) but the internal helper functions — `scoreCardsForTransaction`, `buildAssignments`, `buildCardResults`, `calculateCardOutput`, `getCardName` — have no JSDoc. These functions implement the core optimization algorithm and are non-trivial (e.g., `buildAssignments` accumulates alternatives across transactions). Without docs, contributors must reverse-engineer the marginal-scoring approach.

**Suggested fix:** Add JSDoc to `scoreCardsForTransaction` (explaining marginal reward scoring) and `buildAssignments` (explaining the accumulation logic).

---

### 7. Cycle-reference convention creates documentation-maintenance burden
**Files:** pervasive (e.g., `apps/web/src/lib/parser/pdf.ts`, `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/store.svelte.ts`)  
**Severity:** Medium  
**Confidence:** Medium

Comments throughout the codebase include cycle references like `(C81-01)`, `(C72-02)`, `(C6UI-16)`, `(D7-M4)`. While these link fixes to specific review cycles, they create several problems:

1. **No index:** There is no `C81-01` lookup table in the repo. A new contributor cannot resolve what "C81-01" means without access to historical cycle review artifacts.
2. **Comment bloat:** Lines like `// C27-01: Require either a comma...` mix the fix rationale with an opaque cycle ID, making comments longer than necessary.
3. **Rot risk:** If cycle review files are ever archived or lost, the references become meaningless noise.
4. **Inconsistent prefixes:** Some use `C##-##`, some `C##UI-##`, some `D##-M#`, some `F#-##`. No documented convention explains these prefixes.

**Suggested fix:** Either (a) create a `docs/cycle-references.md` index mapping IDs to descriptions, or (b) migrate to self-contained comments that explain the rationale without requiring external lookup.

---

### 8. `scripts/build-json.ts` usage comment references obsolete Node flag
**File:** `scripts/build-json.ts:5`  
**Severity:** Medium  
**Confidence:** High

```typescript
 * Usage: node --experimental-strip-types scripts/build-json.ts
```

Node.js 24 (the project's target runtime per `CLAUDE.md`) has `--experimental-strip-types` stable. However, the `package.json` scripts use `bun run scripts/build-json.ts`, not Node. The comment is technically correct but misleading about actual project usage.

**Suggested fix:** Update to `Usage: bun run scripts/build-json.ts` to match actual practice.

---

### 9. `CategoryTaxonomy.findCategory` — comment on fuzzy match threshold is partially misleading
**File:** `packages/core/src/categorizer/taxonomy.ts:88-91`  
**Severity:** Low  
**Confidence:** Medium

```typescript
// Prefer the shortest keyword that contains the merchant name
// (shorter keyword = tighter fit, more likely correct)
```

The comment claims "shorter keyword = tighter fit" but the actual code selects the keyword with the *smallest* `kw.length`, which means the shortest keyword that contains the merchant. For example, if merchant is "스타벅스" and keywords include "스타벅스" (7 chars) and "스타벅스커피" (10 chars), the shorter one wins. The logic is correct, but "tighter fit" is ambiguous — it could be read as "more specific" which is the opposite of what happens.

**Suggested fix:** Clarify: "shorter keyword = less specific wrapper, preferred to avoid overfitting to long compound names."

---

### 10. `analyzer.ts` comment typo: "FRESH monthly breakdown" should clarify "recalculated"
**File:** `apps/web/src/lib/analyzer.ts:566`  
**Severity:** Low  
**Confidence:** Low

```typescript
// No explicit value — compute from the FRESH monthly breakdown
```

"FRESH" is capitalized for emphasis but without context it reads as jargon. A brief parenthetical would help.

**Suggested fix:** `// No explicit value — compute from the recalculated (fresh) monthly breakdown`

---

## Likely Issues / Risks

### 11. No architecture decision records (ADRs) for major design choices
**Severity:** Medium  
**Confidence:** Medium

Several major design decisions are documented only as inline comments:
- Why the greedy optimizer was chosen over exact/ILP solvers
- Why PDF parsing uses a 3-tier fallback (structured → line scanner → LLM)
- Why the web app duplicates parser logic instead of sharing `packages/parser`
- Why sessionStorage is used instead of localStorage or server persistence

These are scattered across source files. Without consolidated ADRs, future maintainers must grep for comments to understand rationale.

**Suggested fix:** Add lightweight ADR files in `.context/decisions/` or similar.

---

### 12. `packages/parser/src/pdf/llm-fallback.ts` — `SYSTEM_PROMPT` has no version or changelog
**Severity:** Low  
**Confidence:** Medium

The LLM system prompt is a critical piece of documentation (it defines the contract with the Anthropic API). It is embedded as a string literal with no version, no date, and no record of past iterations. If the prompt is tuned in the future, there is no way to track what changed or why.

**Suggested fix:** Add a `const PROMPT_VERSION = '1.0'` and a brief changelog comment above `SYSTEM_PROMPT`.

---

### 13. Missing module-level documentation on `packages/core/src/categorizer/index.ts`
**File:** `packages/core/src/categorizer/index.ts`  
**Severity:** Low  
**Confidence:** Medium

This file is just three export lines with no module documentation. As the public entry point for the categorizer, it should explain the relationship between `CategoryTaxonomy`, `MerchantMatcher`, and `MERCHANT_KEYWORDS`.

---

### 14. `packages/core/src/models/card.ts` — trivial re-export with no added value
**File:** `packages/core/src/models/card.ts`  
**Severity:** Low  
**Confidence:** Low

```typescript
export type { CardMeta, CardRuleSet } from '@cherrypicker/rules';
```

This file exists purely to re-export types from another package. There is no JSDoc explaining why this indirection exists (e.g., "Re-exported here so core consumers don't need to depend on @cherrypicker/rules directly"). While the reason may be obvious to the original author, it is not to new contributors.

---

## Positive Findings

### P1. Excellent inline rationale in `store.svelte.ts`
**File:** `apps/web/src/lib/store.svelte.ts`

This file sets the gold standard for documentation in the codebase. Every non-trivial block has a comment explaining:
- Why a design choice was made (e.g., cache invalidation strategy)
- What bug it prevents (with cycle references)
- Edge cases handled (AbortError, quota exceeded, version mismatch)
- The contract for each function

**Notable example (lines 520-521):**
```typescript
// Snapshot the result immediately after the null guard so that all
// subsequent reads use the same value. Without this, the reactive
// $state variable could change during the async gaps...
```

### P2. Good JSDoc on exported calculator functions
**Files:** `packages/core/src/calculator/{types,discount,points,cashback}.ts`

All exported calculator functions have complete JSDoc with `@param` tags, descriptions, and rationale for the shared `calculatePercentageReward` primitive.

### P3. Accessibility comments in Svelte components
**File:** `apps/web/src/components/upload/FileDropzone.svelte`

ARIA-related markup includes comments explaining why specific attributes were chosen (e.g., `aria-current="step"` vs `role="progressbar"`, color contrast ratios). This is rare and valuable.

### P4. Cross-parser parity comments
**Files:** `apps/web/src/lib/parser/pdf.ts`, `packages/parser/src/pdf/index.ts`

Comments explicitly call out when logic must stay in sync between the browser and server-side PDF parsers (e.g., `(C63-01, parity with web-side)`). This prevents silent divergence.

---

## Final Sweep: Commonly Missed Documentation Issues

| Check | Result |
|---|---|
| Missing LICENSE file | LICENSE exists (Apache 2.0) |
| Missing CHANGELOG | No CHANGELOG.md found |
| Missing CONTRIBUTING guide | No CONTRIBUTING.md found |
| Missing API docs | No generated API docs (TypeDoc, etc.) |
| Code comments in Korean | Comments are mixed Korean/English; acceptable for Korean-market tool but inconsistent |
| README installation instructions | Correct and complete |
| README quick-start examples | Correct and match actual commands |
| Package scripts documented | Only in README, not in package.json comments |
| Test file documentation | Test files have minimal inline docs; mostly self-describing via test names |

---

## Recommendations (Prioritized)

1. **Fix README accuracy issues** (#1, #2, #3) — these are user-facing and erode trust.
2. **Add module-level JSDoc** to `packages/rules/src/index.ts`, `packages/core/src/categorizer/index.ts`, and `packages/core/src/models/card.ts`.
3. **Document internal optimizer functions** in `greedy.ts` — the marginal-scoring algorithm is the heart of the product.
4. **Create a cycle-reference index** or migrate to self-contained comments.
5. **Add a lightweight CHANGELOG.md** tracking user-facing changes.
6. **Consider TypeDoc or similar** for auto-generated API documentation from the extensive JSDoc already present.
