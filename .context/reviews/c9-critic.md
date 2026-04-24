# Cycle 9 — Critic

## C9-CT01: Hardcoded taxonomy duplicate pattern is now at 7 instances — structural fix overdue
- **Severity:** MEDIUM
- **Confidence:** High
- **Description:** This is the 6th cycle (C7, C8, now C9) where the hardcoded-taxonomy-duplicate pattern has been identified. Each cycle finds more instances. The pattern is systemic: any data that exists in YAML/JSON is copied into TypeScript constants that must be manually maintained in lockstep. A build-time generation step is the only viable fix. Partial fixes (removing one instance at a time) are insufficient because new instances are added by developers who don't realize the pattern exists.
- **Recommendation:** Prioritize a dedicated build-time generation mini-cycle. The exit criterion for C7-01/C7-02/C8-01 (all deferred under the same criterion) should be expanded to cover all 7 instances found this cycle.

## C9-CT02: No new HIGH findings this cycle
- **Description:** The codebase has stabilized considerably. All findings this cycle are MEDIUM or LOW, and they are all variants of the same systemic pattern (hardcoded duplicates). No new logic bugs, security issues, or correctness problems were found beyond the known pattern.

## C9-CT03: Review convergence continues
- **Description:** Cycles 7-9 have produced diminishing new findings: C7 had 4, C8 had 2, C9 has 2 new distinct issues (the 2 additional hardcoded-map instances). The review is converging. Future cycles should focus on implementing the build-time generation fix rather than finding more instances of the same pattern.
