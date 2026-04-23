# Cycle 96 — critic pass

**Date:** 2026-04-23

## Skeptical re-examination of C96-01

**Counter-argument 1: Is this actually reachable?**
The parser layer has many hardcoded Korean and ISO date formats. For production Korean credit card statements, every format the repo currently supports is covered by `parseDateStringToISO`. However, the function is advertised as handling arbitrary user input: CSVs from non-Korean banks, custom exports, edge-case formats like abbreviated Korean ("1.15" with only month and 1-digit day), and hand-edited files. The `console.warn` and `parseErrors.push` paths exist precisely because the authors expect unparseable inputs. C96-01 is the realistic-but-rare combination of "every row fails the date parse."

**Counter-argument 2: Isn't this a parser bug rather than an analyzer bug?**
Partially yes — parsers could drop unparseable-date rows instead of passing them through. But:
- The current design intentionally surfaces parse errors via `result.errors` so users see per-line feedback.
- Changing parsers to drop rows would hide data loss that users may want to notice.
- The analyzer-layer throw is a defense-in-depth check that prevents a silent success regardless of parser policy. It is not a replacement for the parse-error messaging, which continues to work.

Both defenses (parser error array + analyzer length check) are complementary and neither is sufficient alone.

**Counter-argument 3: Should the error be caught more gracefully upstream and surfaced as `parseErrors` rather than a throw?**
The throw matches the sibling error at `analyzer.ts:311` ("거래 내역을 찾을 수 없어요"), which also uses `throw new Error(...)` to surface a blocking failure. Consistency argues for the throw. A partial-success variant (optimize what we can, warn about the rest) would require more changes and risks masking the problem.

**Verdict:** Accepted. C96-01 is a real, reachable, MEDIUM-severity defect. The fix is minimal, consistent with existing patterns, and does not require reshaping the parser contract.

## Accepted tradeoffs (no new findings)

All other trade-offs flagged in cycle 95 remain defensible:
- `!` assertions that are guarded by length checks (analyzer.ts:361, 366).
- MerchantMatcher O(n) scan — deferred pending profiling.
- Duplicate CSV helpers between web and server — deferred pending audit.

No other critic-level concerns this cycle.
