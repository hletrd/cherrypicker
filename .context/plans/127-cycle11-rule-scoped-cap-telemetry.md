# Plan 127 — Cycle 11 Rule-Scoped Cap Telemetry

**Findings:** C11-003 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Real `kb-all` rules correctly produce 5,000 Won and 10,000 Won
  `monthly_category` cap events in the same `online_shopping` bucket.
- `CategoryReward.capAmount` is overwritten by the last contributing rule,
  while `capsHit` already retains the plural events.
- Web coherence requires every monthly-category event to equal the one
  singular field and therefore rejects the balanced optimizer result.
- Worker and persistence decoders validate the current DTO shape, and current
  v4 persisted sessions may legitimately lack any new cap identity.

## Outcome

`capsHit` is the authoritative plural cap telemetry. New rule-scoped cap
events carry stable rule and cap-group identity, while the ambiguous singular
category field remains accepted only as deprecated legacy input.

## Implementation

1. Add a red current-card regression: one 100,000 Won overseas Amazon purchase
   on `kb-all` validates with one cap; two purchases produce 15,000 Won,
   distinct 5,000/10,000 cap events, and must also validate.
2. Add optional `ruleId` and `capGroup` identity to rule-scoped `CapInfo`.
   Emit both for per-transaction and monthly-category events; omit them for
   the card-wide monthly-total cap.
3. Stop writing `CategoryReward.capAmount` for new calculator output. Retain
   the optional field as deprecated wire compatibility for existing v4
   sessions and fixtures.
4. Make the optimizer-worker decoder require non-empty identity on newly
   produced rule-scoped cap events. Keep persistence decoding
   backward-compatible: legacy v4 events may lack identity, but malformed
   optional values fail closed.
5. Keep `capReached`, category membership, safe-integer, and
   `appliedReward <= actualReward` checks. Apply the old singular equality
   check only to legacy categories with exactly one monthly-category event;
   a singular value has no sound meaning for zero or multiple events.
6. Add worker, coherence, persistence round-trip/truncation, and visualization
   coverage for two same-category cap events. Include a shared-cap-group
   control and do not deduplicate repeatable per-transaction events.

## Acceptance

- [x] The real `kb-all` two-purchase optimizer result remains 15,000 Won and
      passes web coherence.
- [x] New rule-scoped cap events carry non-empty `ruleId` and `capGroup`.
- [x] `capsHit` preserves both same-category events and downstream
      disclosures render both.
- [x] New calculator output omits the ambiguous singular category cap.
- [x] Existing coherent v4 payloads without cap identity still deserialize;
      malformed new identity fails closed.
- [x] Legacy one-cap singular agreement and mismatch tests remain meaningful.
- [x] No storage-version bump invents unrecoverable historical rule identity.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 used the approved
manual red-green fallback across the core producer, worker wire boundary, web
coherence, persistence, and visualization consumers before repository-wide
gates. No deployment was part of this plan.

## Completion evidence

- Commit: `c0bebe869adfbf36f0a569ceedfe8359673af0c2`
  (`🐛 fix(core): preserve rule-scoped cap telemetry`).
- Expected red: 14 new contract assertions failed while 262 controls passed.
- Focused green: 276 tests passed. Full package evidence added 268 core tests,
  829 web tests followed by 177 final changed web tests, and 23 visualization
  tests.
- The real one- and two-purchase `kb-all` controls validate at 5,000 and
  15,000 Won. The two cap events retain distinct rule and cap-group identity.
- Worker decoding requires current rule-scoped identities; v4 persistence
  accepts valid legacy identity-less events and preserves new identities
  without a storage-version bump.
