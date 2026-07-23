# Review-plan-fix Cycle 7 — tracer

**Review baseline:** `3086a379e31e5b17f82401807f5b3c24325b9962` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified and read all 2,175 tracked paths: 1,045 context/planning/review
paths, 151 web paths, 868 package paths, 59 tool paths, 18 scripts, 15 E2E
paths, and 19 root/config/vendor/instruction paths. This includes 320 tracked
TS/JS/Svelte/Astro files, 147 test paths, all 683 card YAML files, and 72
JSON/CSV inputs or generated artifacts. Every review-relevant path was
included in the source/search pass and the complete tracked-file content read;
none was skipped.

I traced these end-to-end paths and their failure branches: upload admission →
quick issuer hint → format detection → transferable worker payload → parsed
rows and diagnostics → ordered multi-file merge → categorization → calendar
scope → performance-spending provenance → optimizer worker → result ownership
→ persistence → dashboard/report; category edit → reoptimization → persistence;
YAML/scraper source metadata → semantic validation → publication identity →
web split catalogs and CLI compiled catalogs; and CLI parsing → calculation →
terminal/standalone HTML output. I also followed abort, stale result, partial
file failure, invalid row, artifact mismatch, storage truncation/corruption,
unsupported-rule, and cap-disclosure paths. Historical plans/reviews were
searched before classifying this finding as new.

## RPF7-TRACE-001 — persisted warning summaries invent a second source file

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Aggregation location:** `apps/web/src/lib/persistence.ts:404-470`
- **Persistence reach:** `apps/web/src/lib/persistence.ts:108-131,650-709`
- **Visible sink:** `apps/web/src/components/ui/AnalysisWarnings.svelte:13-23,
  31-36,54-63`

The live result gives each parser diagnostic its real `fileName`. When more
than 100 warnings are persisted, `boundedParseWarnings()` retains the first 99
and combines all remaining warning counts into one synthetic entry whose
`fileName` is the literal `"기타 업로드 파일"`. The restored UI derives
`affectedFileCount` by putting every warning `fileName` into a `Set`, without
distinguishing a summary record from a source identity.

The omitted row count is preserved, but source ownership is not. The synthetic
label can inflate the affected-file count, or collapse warnings from several
omitted files into one invented file and undercount them. This makes the same
successful analysis report different provenance before and after a refresh.

The executable boundary probe used 101 warnings, all owned by `one.json`.
`boundedParseWarnings()` returned 100 records with a correct affected-item
total of 101, but the distinct names were:

```text
["one.json", "기타 업로드 파일"]
```

`AnalysisWarnings.svelte` consequently reports two affected files after
restore even though only one file was uploaded.

**Concrete failure:** a statement produces 101 row warnings and at least one
valid transaction. Immediately after analysis the banner says one file is
affected. After navigation/reload restores the persisted result, it says two
files are affected and lists “기타 업로드 파일” as though it were an input.
With warnings ordered across three real files, the same summary can instead
hide the identities of files whose warnings fell after the first 99.

**Root-cause fix:** preserve summary provenance as data, not as a fabricated
filename. A bounded representation can retain per-file buckets containing
`fileName`, `format`, retained examples, and omitted counts, plus an explicit
total affected-file count. If the current flat type must remain temporarily,
give summary records an explicit `summary: true`/`kind` field and store the
exact affected-file count separately; exclude summary labels from the
filename `Set`. Add round-trip tests for 101 warnings from one file and for
warnings spanning more files than the retained prefix, asserting identical
affected-file and affected-item counts before and after serialization.

## Verification

- Direct persistence probe: **confirmed** one real filename becomes two
  distinct displayed filename values while the row total remains 101.
- `bun run data:check`: **passed** for all 683 authored cards and every
  generated/publication documentation contract.
- `bun run typecheck`: **passed** in all seven workspaces; the web check
  reported 0 errors, 0 warnings, and 0 hints.
- No source, test, plan, generated artifact, protected Cycle 42 file, or
  pre-existing review file was modified.

## Final missed-issue sweep

The bounded final trace sweep rechecked operation epochs, abort composition,
quick-hint ownership, input-order merge, transaction IDs, bank/format
identity, previous-month provenance, fact provenance, unsupported-rule
deduplication, catalog source hashes, parser error identity, storage
migrations, report context, terminal sanitization, and partial multi-file
failures. Cycle 6's quick-hint and BNK identity findings were verified as
fixed and not re-reported. No second new, non-duplicate trace defect met the
evidence threshold.

Final count: **1 Low finding**, confirmed with High confidence.
