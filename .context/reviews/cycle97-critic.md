# Cycle 97 — critic pass

**Date:** 2026-04-23

## Scope

Skeptical multi-perspective critique of C97-01 and C97-02 candidates.

## Interrogation of C97-01

Q: Is this actually a bug worth fixing, or is the graceful `formatPeriod → '-'` degradation sufficient?

A: It's worth fixing because:
1. `fullStatementPeriod` is persisted to sessionStorage, so garbage strings are written to durable storage. That's a latent data-integrity concern even if no current consumer exhibits the bug.
2. `ReportContent.svelte:9` uses `statementPeriod` (not `fullStatementPeriod`) and passes its `start`/`end` through `formatYearMonthKo` which also degrades gracefully. But a future consumer added without review might not.
3. The fix is trivial (add `.filter(d => d.length >= 10)`) and has no perf cost or regression surface.

Q: Is the severity right?

A: LOW is correct. No user sees wrong data today — they see `'-'`. The fix is defense-in-depth.

Q: Is the fix actually needed this cycle, or can it wait for the deferred parser refactor?

A: It can wait for the deferred parser refactor, but fixing the symptom now is cheap and demonstrates review-loop value.

## Interrogation of C97-02

Q: Does this ever happen in practice?

A: Unlikely. The user would have to edit their way into a state where the latest month contains only refunds. That's not typical editing behavior (users add/change categories, not delete-then-refund). I'm rating this as LOW severity, MEDIUM confidence — I'm MEDIUM confident the bug exists, but LOW confident anyone hits it.

Q: Should it be fixed this cycle?

A: Defer to cycle 98+ unless we're already touching the area. This cycle should land C97-01 cleanly and not conflate concerns.

## Verdict

- C97-01: real, LOW severity, HIGH confidence. Fix this cycle.
- C97-02: real but very narrow, LOW severity, MEDIUM confidence. Defer with exit criterion.

## Summary

Accept both findings at LOW severity. Implement C97-01; defer C97-02.
