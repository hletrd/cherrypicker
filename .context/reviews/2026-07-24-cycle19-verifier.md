# Cycle 19 verifier review

## Result

One genuinely new current-baseline defect was independently confirmed:

- **C19-VR-001 — Low / High confidence:** the deliberate lower-bound
  `YearMonth` exception escapes truncated-result coherence and the pure
  persistence deserializer.

The Cycle 18 dependency and catalog repairs otherwise verify cleanly. Review
target: `fcc89801451d1c1a31bb9881d213e117fc4ca923`.

## Inventory and method

The verification inventory covered all 2,409 tracked paths, including all
1,172 active paths and the complete 66-path Cycle 18 delta. Candidate behavior
was traced from constructor to consumers, exercised through focused current-
baseline probes/tests, and reconciled against all tracked current and archived
review/plan history. The six protected untracked Cycle 42 paths were excluded.

Evidence run during this role:

| Check | Result |
| --- | --- |
| focused core/web calendar, publication, and dependency suites | 77 pass, 0 fail, 185 expectations |
| core `tsc --noEmit` | pass |
| web `astro check` | 0 errors, 0 warnings, 0 hints |
| `bun run dependencies:check` | pass |
| `bun run data:check` plus documentation drift | pass; 683 cards, 24 issuers, 551 executable cards |
| `bun audit --json` | empty advisory result |
| generated identity inventory | one hash across 30 advertised identities |
| commit signatures and remote parity | six good signatures; local HEAD equals origin |

No browser, E2E, deployment, publication, or source mutation was used.

## C19-VR-001 — lower-bound predecessor exception escapes validation

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed** by source trace and two current-baseline runtime probes
- Introduced boundary:
  `packages/core/src/analysis/context.ts:77-114`
- Truncated coherence caller:
  `apps/web/src/lib/analysis-result.ts:893-920,922-981`
- Persistence admission and escaping call:
  `apps/web/src/lib/persistence.ts:522-547,677-708,720-922`
- Store-level catch and user-visible fallback:
  `apps/web/src/lib/store.svelte.ts:117-148`
- Missing regression surface:
  `apps/web/__tests__/analysis-context.test.ts:34-65`;
  `apps/web/__tests__/store-persistence.test.ts:630-696,720-820`

`parseYearMonth()` and `isYearMonth()` intentionally admit `0000-01`.
`previousCalendarMonth()` intentionally raises a `RangeError` because no
four-digit predecessor exists. Those two decisions are individually explicit.
The truncated coherence path, however, validates only that each breakdown key
is a `YearMonth`, finds the latest month, and then unconditionally calls:

```text
previousCalendarMonth(latest.month)
```

This occurs before `hasExactPreviousSpendingBasis()` can take its
`user-total` branch, so even a snapshot whose previous spending is supplied
explicitly requests an unnecessary predecessor. For statement/missing bases,
the exception likewise escapes instead of yielding an incoherent verdict.

Two focused probes confirmed:

1. `isAnalysisResultCoherent()` given an otherwise internally balanced,
   truncated `0000-01` snapshot raises
   `RangeError: YearMonth 0000-01 has no representable previous month`.
2. `deserializeAnalysis()` given the same structurally admitted current-version
   snapshot raises the same exception instead of returning
   `{ data: null, warningKind: "corrupted", shouldRemove: true, ... }`.

The application store catches that unexpected exception, removes the persisted
entry, and reports the generic storage-access error. The page therefore
recovers rather than crashing permanently, which bounds impact. Direct callers
of the exported pure deserializer still receive an exception, and the error is
misclassified as storage access rather than corrupted domain state.

### Root cause and fix

Cycle 18 correctly made `0000-01` a deliberate typed failure at the public
predecessor helper, but consumers that validate untrusted/refined structures
still assume the helper is total. Before `9cb5bfe`, the helper returned a
malformed predecessor and coherence returned false; the escaping exception is
therefore a Cycle 18 regression, not the original leading-zero finding.

Refactor truncated coherence so:

1. a `user-total` basis does not compute a predecessor at all;
2. a statement/missing basis treats the non-representable predecessor as
   incoherent rather than throwing; and
3. persistence regression tests prove both `isAnalysisResultCoherent()` and
   `deserializeAnalysis()` remain no-throw/fail-closed for the lower boundary.

Keeping the public helper's explicit `RangeError` is compatible with this fix.

## Cycle 18 repair verification

### Calendar/type repair

Apart from C19-VR-001, the repair is closed over every successful predecessor:
the brand cannot be created by arbitrary literals, same-year leading-zero
months retain their year text, January years are padded, January 1000 selects
December 0999, and the public lower-bound error is exact
(`packages/core/src/analysis/context.ts:3-114`;
`apps/web/__tests__/analysis-context.test.ts:15-65`;
`packages/core/__tests__/analysis.test.ts:127-148`).

### Dependency admission repair

The shared extension set now contains `.mts` and `.cts`; configuration
admission derives from that set and the `config`/`*.config` stem; both
extensions reach production, nested-test, and config ownership classification
(`scripts/check-dependencies.ts:11-22,465-510,532-692`;
`scripts/__tests__/check-dependencies.test.ts:241-296`). The tracked tree has
no current module-TypeScript source, and the expanded checker reports no
ownership failure.

### Publication identity repair

Identity-free browser, legacy-full, and legacy-compact projections enter one
canonical keyed payload before hash injection
(`scripts/catalog-publication.ts:93-136,353-412`;
`scripts/build-json.ts:301-400`). The current outputs advertise
`125970f582c040a0c6aa728cab49dea1173c1e7fbd96fc297876c5197291c200`
across all 30 identity sites. Legacy copies report `2.0.0`; browser summary
remains `1.0.0`. Mutation/key-order and tracked-output tests pass
(`scripts/__tests__/catalog-publication.test.ts:527-796`).

## Final sweep

No additional candidate survived the closing search over changed exception
paths, calendar consumers, persistence validation, catalog hash injection,
generated version/hash readers, source-extension discovery, manifest
ownership, peer/vendor checks, and Cycle 18 history. Confirmed findings: **1**;
likely findings: **0**; manual-only risks promoted: **0**.
