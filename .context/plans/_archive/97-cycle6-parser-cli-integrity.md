# Plan 97 — Cycle 6 Parser, CLI, and Decode Integrity

**Findings:** C6-004 (Medium/High), C6-005 (High/High), C6-006 (Medium/High), C6-007 (Low/High)  
**Status:** complete  
**Deploy mode:** none

## Evidence

- `packages/parser/src/shared/required-fields.ts:1-27` defines merchant as
  required, while JSON, HTML, OFX, PDF, browser mirrors, and
  `apps/web/src/lib/tx-validation.ts:51-61` accept blank merchant values.
- `packages/parser/src/ofx/index.ts:43-169` and the browser OFX parser ignore
  `<CURDEF>`; CLI/web adapters then assign `currency: 'KRW'`.
- `tools/cli/src/commands/analyze.ts:32-68` sends an empty parse to
  `packages/viz/src/terminal/summary.ts:19-50`, which renders a 100% total and
  exits successfully.
- `packages/parser/src/shared/encoding.ts:20-27,209-252,294-302` validates
  common UTF-8 bytes twice and decodes them a third time.

## Outcome

Every parser enforces the same nonblank merchant contract, OFX reaches
optimization only when it explicitly declares KRW, empty CLI analysis fails
closed, and common text formats decode UTF-8 in one whole-input pass.

## Implementation

1. Apply `normalizeRequiredMerchant` and the shared
   `missing_required_merchant` code at JSON, server/browser HTML, OFX,
   structured PDF, LLM-PDF response, and persisted-transaction boundaries.
   Require a merchant column for HTML, require one nonblank `NAME`/`MEMO` for
   OFX, skip invalid PDF rows, and retain bounded row diagnostics.
2. Parse statement-level OFX `<CURDEF>` in both server and browser paths before
   transaction conversion. Accept only normalized `KRW`; emit stable,
   actionable diagnostics and no transactions for an absent or unsupported
   currency because the product has no exchange-rate contract.
3. After displaying parse warnings, make CLI `analyze` throw when no valid
   transactions remain. Keep the visualization defensive by rendering a 0%
   empty total if it is called directly.
4. Introduce a detect-and-decode result that returns both encoding metadata and
   already decoded text. Reuse the fatal UTF-8 decode performed during
   detection instead of revalidating/redecoding; decode a declared non-UTF-8
   input once with its selected decoder. Preserve the public metadata-only API
   as a thin boundary where needed.

## Tests

- Server/browser parity for missing merchant columns/fields, whitespace-only
  merchant, mixed valid/invalid rows, bounded diagnostics, PDF inference, LLM
  responses, and persistence restoration.
- OFX parity fixtures for KRW, USD, missing `<CURDEF>`, SGML/XML forms, bank
  and credit-card statements, and proof that foreign currency cannot reach
  CLI/web optimization.
- Fresh-process CLI tests for empty and wholly rejected statements: exit 1,
  actionable Korean error, and no normal spending summary.
- Decoder pass-count tests for UTF-8 JSON and undeclared OFX/HTML plus existing
  BOM, CP949, UTF-16, invalid-byte, and maximum-size behavior.
- Parser, web, CLI, viz, type, lint, unit/Vitest, build, data, and final
  browser gates.

## Acceptance

- [x] No supported format or persisted record emits an optimizable blank
  merchant.
- [x] Missing or non-KRW OFX currency fails before a KRW transaction exists.
- [x] Empty `analyze` returns a nonzero exit without a false 100% summary.
- [x] The common UTF-8 path performs one whole-input decode.

## Completion evidence

- Required-merchant enforcement now covers all planned parser and persisted
  boundaries; empty analysis fails closed and the visualization's defensive
  empty total is 0%.
- Server and browser OFX paths bind currency to each transaction-bearing
  statement and reject missing, foreign, mixed, nested, or ambiguous currency.
  The closing parity audit passed 49 targeted OFX tests.
- The common UTF-8 path reuses its fatal validation decode. The full parser
  suite passed 1,684 tests and the Bun-targeted parser/scraper gate passed
  1,761 tests.

## Execution note

`ralph` is unavailable in the installed skill roots. Prompt 3 will use a
manual test-first loop with server/browser parity checked after every parser
boundary change.
