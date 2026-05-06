# Cycle 32 Deep Code Review Instructions

Review the entire /Users/hletrd/flash-shared/cherrypicker repository from your assigned specialty angle.

## Steps
1. Build an inventory of review-relevant files (source, test, config, docs).
2. Examine every relevant file. Do not sample only a subset.
3. Analyze individual files AND cross-file interactions.
4. Pay close attention to correctness, edge cases, failure modes, maintainability risks.
5. Systematically look for: logic bugs, missed edge cases, race conditions, error-handling problems, invalid assumptions, data-flow issues, security weaknesses, performance problems, test gaps, documentation mismatches.
6. Do NOT assume tests or comments are correct. Validate behavior from the code.
7. For each finding, cite exact file path and code region, explain why it is a problem, describe a concrete failure scenario, suggest a fix.
8. Label confidence: High, Medium, Low.
9. Distinguish confirmed issues, likely issues, and risks needing manual validation.
10. Do one final sweep for commonly missed issues and confirm no relevant file was skipped.

## Output
Write your complete review to /Users/hletrd/flash-shared/cherrypicker/.context/reviews/ROLE.md (replace ROLE with your exact role name, e.g. code-reviewer.md, security-reviewer.md, etc.).
