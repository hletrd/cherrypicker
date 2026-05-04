# Critic — Cycle 3

## F-CRIT-01: The review-plan-fix loop is accumulating deferred items faster than resolving them
**Severity: Medium | Confidence: High**

After 2 cycles of the current loop (plus 98+ previous cycles), there are 8 deferred items from cycle 2 alone. The user's focus is "make it work with diverse formats." The most impactful remaining change (web-side adapter-factory refactor, F-ARCH-01) has been deferred since cycle 1.

## F-CRIT-02: Web-side parsers are the user-facing parsers but are the least robust
**Severity: High | Confidence: High**

The user interacts with the web app. The server-side CLI parsers have ColumnMatcher, adapter-factory, category-based header detection. The web-side bank adapters still use exact indexOf(). The user gets WORSE parsing from the app they actually use than from the CLI tool.

## F-CRIT-03: Test coverage is asymmetric
**Severity: Medium | Confidence: High**

Server-side: CSV tests exist (2 fixtures), date-utils tests exist, detect tests exist.
Web-side: Zero tests.
XLSX: Zero tests (parity test only).
PDF: Zero tests.

For a tool whose value proposition is parsing diverse formats, this is inadequate.
