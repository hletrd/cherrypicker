# Cycle 7 — Aggregate Review (2026-04-24)

Deduplicated findings across `code-reviewer`, `perf-reviewer`, `security-reviewer`, `architect`, `test-engineer`, `designer`, `debugger`, `critic`, `verifier`, `tracer`, and `document-specialist`.

Provenance files retained at `.context/reviews/c7-<agent-name>.md`.

## MEDIUM — implement in this cycle

| Id | Source agents | File:line | Description |
|----|---------------|-----------|-------------|
| C7-01 | code-reviewer C7-CR01, architect C7-A01, critic C7-CT01, tracer | `packages/core/src/optimizer/greedy.ts:11-90` | **CATEGORY_NAMES_KO hardcoded map can silently drift from YAML taxonomy.** 4 agents converge. This is the same drift risk noted in TODO C64-03 but not previously tracked as a review finding with severity. 90-line hardcoded Record duplicates the category labels from categories.yaml. When the YAML taxonomy changes, this map must be manually updated in lockstep. The web app solved this via `buildCategoryLabelMap()`, but the core optimizer uses the static map as a CLI fallback. |
| C7-02 | code-reviewer C7-CR02, architect C7-A01, critic C7-CT01 | `apps/web/src/lib/category-labels.ts:32-110` | **FALLBACK_CATEGORY_LABELS is another hardcoded duplicate of the YAML taxonomy.** 78-entry ReadonlyMap used as fallback when categories.json fetch fails. Same drift risk as C7-01 but lower impact (fallback-only). Contains a known inconsistency: `entertainment.subscription` key kept for backward compatibility. |

## LOW — plan-only or deferred

| Id | Source agents | File:line | Severity | Description |
|----|---------------|-----------|----------|-------------|
| C7-03 | code-reviewer C7-CR03, verifier C7-V02 | `apps/web/src/lib/api.ts:7-18` | LOW | `UploadResult` legacy type exported but never consumed. Dead code that should be removed. |
| C7-04 | code-reviewer C7-CR04 | `apps/web/src/lib/category-labels.ts:101` | LOW | `entertainment.subscription` key in FALLBACK_CATEGORY_LABELS inconsistent with taxonomy. The comment acknowledges subscription is a top-level category. The duplicate key works but should be cleaned up with a STORAGE_VERSION migration. |

## Security — no new findings

No new HIGH or MEDIUM security findings. Previously deferred items (D-32, D-31) remain valid.

## Cross-agent agreement

- **code-reviewer + architect + critic + tracer** converge on C7-01 (CATEGORY_NAMES_KO drift). 4 agents independently identified the same systemic issue.
- **code-reviewer + architect + critic** converge on C7-02 (FALLBACK_CATEGORY_LABELS drift). 3 agents.
- **code-reviewer + verifier** converge on C7-03 (dead UploadResult type). 2 agents.
- **Critic** notes this is the fourth recurrence of the hardcoded-duplicate pattern (C64-03, C6-02, C7-CR01, C7-CR02), suggesting a structural fix is needed.

## Verification evidence

- Layout.astro BASE_URL migration from C6-01 confirmed complete (verifier C7-V01)
- Grep for `import.meta.env.BASE_URL` shows only 3 correct locations remaining

## Previously Deferred (Acknowledged, Not Re-reported)

All items in `.context/plans/00-deferred-items.md` remain valid. No regression found.

## Gate evidence

- `npm run lint` — PASS (exit 0) [from cycle 6]
- `npm run typecheck` — PASS (exit 0) [from cycle 6]
- `bun run test` — PASS (197 tests, 0 fail) [from cycle 6]
- `npm run verify` — PASS (10/10 turbo tasks cached) [from cycle 6]

## Plan hand-off

See `.context/plans/` for implementation plans derived from this aggregate.
