# Cycle 97 — architect pass

**Date:** 2026-04-23

## Scope

Architectural/design risks, coupling, layering.

## Findings

None net-new at the architecture level.

## Boundary observations

- **Parser → analyzer date-validity contract.** Cycle 96's architect pass flagged this as a future refactor candidate: `parseDateStringToISO` returns `string` unconditionally, and the only signaling of unparseable input is via the `errors` array. C97-01 is a second symptom of the same root cause (the first was C96-01). A typed return (`{ ok: true; date: string } | { ok: false; raw: string }`) or filtering at the parser boundary would eliminate both.

  **Status update on cycle 96 architect's flag:** the follow-up candidate remains MEDIUM-effort, but after C97-01 I now see that *two* downstream symptoms exist (C96-01 `monthlySpending`-empty and C97-01 fullStatementPeriod pollution). That raises the cost-benefit ratio slightly. Still, the follow-up is a dedicated cycle's worth of work (parser return type change + all consumers + tests); not merging it with this cycle's narrow fix.

  **Recommendation:** keep this deferred with the same exit criterion as cycle 96 (dedicated refactor cycle). The cycle 97 C97-01 fix adds a second symptomatic guard, which is acceptable as a narrow fix.

## Summary

No net-new architecture findings. Cycle 96's deferred refactor remains deferred at the same priority.
