# Cycle 31 Code Review

**Scope:** Full re-read of parser additions (HTML, OFX, JSON), web-side parity, store/analyzer, and verification of prior open findings.

---

## New Findings

### C31-CR01 | LOW | High | `packages/parser/src/csv/shared.ts` and `apps/web/src/lib/parser/amount.ts`

**`parseAmountString` allows malformed numeric strings like `1-2-3` to parse as `1`**

After cleaning, the function checks `dotCount > 1 || cleaned.endsWith('.')` but does not validate that the cleaned string contains only digits and at most one optional leading minus. `parseFloat('1-2-3')` returns `1`, silently accepting garbage input. While this requires specifically malformed data, it represents a correctness gap.

**Fix:** Add a validation regex after cleaning: `/^-?\d+(?:\.\d+)?$/.test(cleaned)` before calling `parseFloat`.

### C31-CR02 | LOW | Medium | `apps/web/src/lib/parser/ofx.ts:53-80` and `packages/parser/src/ofx/index.ts:82-109`

**`parseOFXDate` timezone conversion technique is correct but extremely non-obvious**

The function creates a Date with a timestamp shifted by +9 hours, then reads it back with `getUTC*` methods. This is a clever trick to get KST values, but there is no comment explaining why `getUTC*` is used instead of local getters. A future maintainer might "simplify" it to `getFullYear()` and introduce a bug.

**Fix:** Add a comment explaining that `getUTC*` on a +9h-shifted Date yields KST values.

### C31-CR03 | LOW | Medium | `apps/web/src/lib/parser/json.ts:66-75` and `packages/parser/src/json/index.ts:67-76`

**`findField` does redundant case-insensitive matching for Korean aliases**

For each alias, the code first checks `Object.hasOwn(obj, alias)`, then falls back to iterating all keys with case-insensitive comparison. Korean aliases (e.g., `이용일`, `거래금액`) have no case variation, so the fallback iteration is pure overhead for every Korean alias that doesn't match on the first try.

**Fix:** Separate English aliases (which need case-insensitive fallback) from Korean aliases, or add an early check for non-Latin aliases to skip the fallback loop.

### C31-CR04 | LOW | High | `apps/web/src/lib/store.svelte.ts:249-275`

**`loadFromStorage` shallow-validates assignment objects**

The function validates that `parsed.optimization.assignments` is an array and that `cardResults` entries have required fields, but individual `assignments` entries are never validated. A corrupted entry missing `assignedCardId` or `category` would pass validation and could crash downstream components like `OptimalCardMap` or `CategoryBreakdown`.

**Fix:** Add validation for assignment entries (check `assignedCardId`, `category`, `spending` are present and correctly typed).

### C31-CR05 | LOW | Medium | `packages/parser/src/pdf/llm-fallback.ts:117-120`

**LLM fallback transaction filter is shallow**

The filter only checks `typeof tx.date === 'string'`, `typeof tx.merchant === 'string'`, `typeof tx.amount === 'number'`. It does not validate that `date` is a valid ISO string, that `amount` is a positive integer, or that `installments` (if present) is a positive integer. Malformed LLM output could propagate invalid data.

**Fix:** Add validation: `amount > 0 && Number.isFinite(amount) && /\d{4}-\d{2}-\d{2}/.test(date)`.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` hardcoded `683/24/45` still present |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` still duplicated between web and packages/parser |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` $effect DOM manipulation still fragile |
| C20-02 | OPEN (LOW) | DATE_PATTERNS/AMOUNT_PATTERNS divergence risk between csv.ts and date-utils.ts |
| C21-02 | OPEN (LOW) | `cards.ts` shared fetch AbortSignal race (deferred) |
| C24-06 | OPEN (LOW) | `buildCardResults` totalSpending no negative amount guard |
| C27-01 | OPEN (MEDIUM) | Bare `catch {}` in `loadFromStorage` inner cleanup inconsistent with `clearStorage` |

---

## Final Sweep

1. No `as any` in production code (only in tests)
2. No `innerHTML` or `eval` patterns found
3. All `JSON.parse` calls either parse trusted data or are wrapped in try/catch
4. No new SOLID violations beyond known deferred items (D-01, D-34)
5. `parseAmountString` `+` prefix stripping is now consistent across web and server (C66-02 confirmed)
