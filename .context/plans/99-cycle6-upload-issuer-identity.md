# Plan 99 — Cycle 6 Upload Ownership and Issuer Identity

**Findings:** C6-011 (Low/High), C6-012 (Medium/High)  
**Status:** complete  
**Deploy mode:** none

## Evidence

- `apps/web/src/components/upload/FileDropzone.svelte:201-237,288-316`
  commits an awaited quick bank hint without generation or file-identity
  ownership.
- The same component maps `bnk` to `BNK경남`, and
  `apps/web/src/lib/formatters.ts:87-110` expands it to `BNK경남은행`.
  Canonical `packages/rules/data/issuers.yaml:72-75` and the published
  `bnk.json` shard identify all shipped `bnk` cards as BNK Busan Bank.

## Outcome

Only the current first file can own the quick bank hint, upload parsing names
the deliberately shared BNK adapter unambiguously, and catalog/filter/badge
surfaces present canonical Busan Bank card identity.

## Implementation

1. Give quick detection a dedicated `OperationEpoch` or monotonic generation.
   Capture both token and first-file identity before awaiting; commit success
   or failure only if the token is current and the same file is still first.
   Invalidate on every admitted mutation, remove, clear, retry/reset, and
   component destruction.
2. Separate parser-adapter labels from catalog issuer labels in one typed
   presentation module. Use an explicit shared-adapter label such as
   `BNK부산·경남` for upload selection/detection, while `bnk` catalog cards,
   filters, badges, and recommendations use canonical `BNK부산은행`.
3. Remove duplicated hard-coded mappings from the dropzone and formatter.
   Prefer published issuer metadata where the catalog record already supplies
   it, with a deterministic typed fallback for noncatalog parser choices.

## Tests

- Deferred-promise component/helper tests resolving A/B in reverse order,
  clear while pending, remove-first-file, rejection after replacement, and
  destroy while pending.
- Unit and contract assertions for upload `bank-pill-bnk`, card-grid issuer
  filter, `IssuerBadge`, and dashboard recommendation identity.
- Focused browser regression using stable selectors in light/dark and desktop
  plus the existing responsive viewports, with exact E2E ownership preflight
  and postflight.
- Web type, lint, unit/Vitest, build, data, and final E2E gates.

## Acceptance

- [x] A stale quick-detection result cannot mutate the current bank hint.
- [x] Upload copy communicates that the parser adapter covers both BNK banks.
- [x] Every shipped `bnk` card is labeled BNK Busan Bank on catalog and
  recommendation surfaces.
- [x] No duplicated global issuer-name map can reintroduce the mismatch.

## Completion evidence

- Quick detection commits only when both its operation epoch and first-file
  identity still match; selection mutations and teardown invalidate ownership.
- Parser-adapter and catalog issuer labels are centralized separately:
  `BNK부산·경남` for upload parsing and `BNK부산은행` for shipped catalog cards.
- Web contract tests, zero-diagnostic lint/type checks, the production build,
  and all 96 regression E2E tests passed.

## Execution note

`ralph` is unavailable. Prompt 3 will use a manual component-contract loop,
then one safely owned browser verification after non-browser gates are green.
