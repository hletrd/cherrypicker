# Cycle 25 — Designer (2026-05-06)

## UI/UX Assessment

No new UI/UX findings in this cycle. The issues identified are backend/parser correctness problems that may manifest as:

- C25-COR01: Users uploading HTML statements on the server (CLI) may see incorrect merchant names or dates in parsed transactions compared to the web upload path. This is a silent data quality issue.
- C25-COR02: The dashboard may show a transaction count that doesn't match the visible transaction list after edits. This is a minor inconsistency that could erode user trust.

## Recommendations

- Consider adding a "parsed X transactions" confirmation message after upload so users can verify the parser found what they expected.
- For C25-COR02, if fixing the counts is deferred, at least ensure the UI derives counts from the actual transaction array rather than stored metadata.
