# Plan 105 — Cycle 7 Persistence and Warning Coherence

**Findings:** C7-006 (Medium/High), C7-008 (Low/High)
**Status:** completed
**Deploy mode:** none
**Archived after:** Cycle 8 review

## Evidence

- `deserializeAnalysis()` filters rejected transactions but returns the
  original optimization, counts, periods, and monthly breakdown.
- `boundedParseWarnings()` assigns omitted warnings to the fabricated filename
  `기타 업로드 파일`; the UI counts that value as another real file.

## Outcome

A restored analysis is one coherent transaction/derivation snapshot, and
warning compaction preserves exact item and file provenance without inventing
an input.

## Implementation

1. Treat a partially invalid transaction array or explicit malformed
   transaction container as atomic corruption: reject the payload, remove it
   from storage, and expose the existing restore error instead of rendering
   stale derivations.
2. Keep the intentional size-truncated snapshot path distinct: an omitted
   transaction field with `_truncatedTxCount` may retain its disclosed
   historical result.
3. Give compacted warnings an explicit summary kind and exact
   `affectedFileCount`; sanitize/validate those fields during round trip.
   Exclude summary labels from source filenames and let the UI prefer the
   stored exact total.
4. Preserve count saturation, filename/message bounds, migration safety, and
   the no-raw-statement persistence contract.

## Tests

- Invalid first/middle/only transactions and malformed containers must return
  `data: null`, `shouldRemove: true`, and no visible optimization.
- Legitimate omitted/truncated payloads remain restorable with their warning.
- Round trips for 101 warnings from one file and warnings spanning many files
  preserve exact file/item totals and never list a fabricated filename.
- Store/dashboard runtime tests assert corrupted derivations cannot render.

## Acceptance

- [x] A rejected persisted transaction cannot coexist with stale optimization.
- [x] Intentional storage truncation remains distinct and disclosed.
- [x] Warning item and affected-file counts survive persistence exactly.
- [x] Summary metadata is never treated as an uploaded filename.

## Completion evidence

- Invalid transaction containers now reject the persisted snapshot atomically
  with removal, while marker-backed intentional truncation remains restorable.
- Warning summaries carry explicit kind and exact file count; item totals
  saturate safely and summary labels never enter filename provenance.
- An independent audit added first/middle/only corruption and real 101-warning
  round-trip coverage; 119 focused tests and the web typecheck passed.

## Execution note

`ralph` is unavailable; Prompt 3 uses atomic-restore and round-trip invariants.
