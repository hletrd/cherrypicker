# Plan 102 — Cycle 7 Parser Direction and Diagnostic Bounds

**Findings:** C7-001 (Medium/High), C7-007 (Medium/High), C7-011 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- `packages/parser/src/csv/column-matcher.ts`, generic CSV/XLSX, their browser
  mirrors, and `packages/parser/src/shared/json.ts` collapse debit, credit,
  charge, refund, and incoming fields into one positive amount.
- `packages/parser/src/shared/json.ts` appends one object per rejected row;
  worker serialization clones all of them. A 2.0 MiB probe produced 400,000
  diagnostics, a 39.9 MiB serialized graph, and about 199.5 MiB RSS.
- Three cases in `packages/parser/__tests__/csv.test.ts` place all assertions
  behind `if (transactions.length > 0)`.

## Outcome

Every tabular/JSON parser resolves amount direction independently of header
order, incoming/refund rows never become spending, and untrusted row
diagnostics stay within a small counted budget before crossing a worker
boundary. CSV regressions fail immediately if all rows disappear.

## Implementation

1. Add one browser-safe amount-field planner that classifies every matching
   header/JSON key as outgoing, neutral, incoming, or directionally ambiguous.
   Check explicit incoming/refund aliases before broad words such as `금액`.
2. Resolve rows across all candidate fields. Accept an unambiguous outgoing
   value, keep current positive-only semantics for neutral amounts, diagnose
   incoming-only rows, and fail closed when populated directions conflict or a
   combined header cannot establish direction. Numeric inference may run only
   when no recognizable amount header exists.
3. Use the planner in server/browser generic and configured CSV, XLSX,
   HTML/table-oriented paths, shared JSON, and any PDF table consumer of the
   common amount pattern. Preserve merge-source ownership and actionable row
   diagnostics.
4. Add one parser-owned diagnostic collector with at most 99 examples plus
   one counted summary. Propagate `count` through both `ParseError` types,
   JSON adapters, analyzer types, and worker serialization/deserialization.
   Apply a defensive worker-side bound and message/raw length caps.
5. Replace the three conditional CSV assertions with exact transaction counts
   and complete expected amount arrays.

## Tests

- Server/browser CSV, XLSX, HTML, JSON, and table parity for both
  `Credit,Debit` orders, Korean refund/incoming aliases, credit-only rows,
  conflicting directions, neutral signed amounts, and combined headers.
- A credit-only CSV must not be rediscovered by numeric inference.
- Large mixed JSON input must retain valid transactions, return at most 100
  diagnostics, preserve the exact affected count, and serialize within a
  fixed bound.
- Worker count round-trip/defensive-cap tests and exact CSV amount arrays.

## Acceptance

- [x] Header order cannot change which debit/credit transaction is spending.
- [x] No explicit incoming/refund amount reaches categorization or rewards.
- [x] Parser and worker diagnostic graphs are bounded with exact omitted counts.
- [x] The three CSV regressions cannot pass with zero parsed transactions.

## Completion evidence

- One shared directional kernel now serves server/browser CSV, XLSX, HTML,
  JSON, and PDF table/text paths. Explicit outgoing negatives normalize to
  spending magnitude; incoming, neutral-negative, and conflicting directions
  fail closed.
- JSON and worker boundaries retain 99 examples plus one exact counted
  summary, with bounded message/raw payloads and `count` round trips.
- Full parser tests passed 1,698/1,698; web parser/analyzer tests passed
  184/184; parser and web typechecks reported zero diagnostics.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 uses a bounded manual
test-first loop and cross-surface parity checks.
