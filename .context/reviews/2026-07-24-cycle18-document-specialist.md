# Cycle 18 document-specialist review

## Result

One current public-contract mismatch was confirmed:

- **C18-DOC-001 — Low:** the exported `YearMonth` type admits strings that the
  same module's runtime `isYearMonth()` contract rejects.

This is distinct in mechanism from the Cycle 18 low-year rollover failure:
invalid caller values compile even if `previousCalendarMonth()` is fixed to
preserve year width. It should nevertheless be repaired and tested in the same
calendar-domain work item, not counted as a separate aggregate root.

No independent publication identity/version documentation root was retained.
The legacy byte/identity mismatch is current, but it is a residual/regression
of completed `C3-008` and Plan 80 rather than a new documentation finding.

Review target: `c182c8144a4284bae1f28f009a5b0930d7762d5c`.

## Documentation inventory and coverage

The review covered all 29 tracked non-`.context` Markdown files:

- the root `README.md`;
- `.claude/AGENTS.md` and `.claude/CLAUDE.md`;
- all 24 generated issuer README files;
- `vendor/README.md`; and
- the remaining repository-owned active plan/document.

It also compared:

- all eight root/workspace manifests and their scripts, exports, toolchain,
  package versions, and CLI entry points;
- the six CLI/scraper help-contract sources, including option arity, defaults,
  examples, consent text, model/configuration wording, and supported issuers;
- generated category-label headers, generated catalog metadata, README count
  markers, and publication comments;
- the public core analysis exports and their runtime validators;
- the complete 15-file non-context Cycle 17-to-HEAD delta; and
- all 1,222 tracked current/archive `.context` paths, plus the available
  non-protected Cycle 18 specialist reports.

`bun run docs:check` passed and reported 683 catalog cards, 551
optimizer-executable cards, and 24 issuers. No external source was needed:
every assessed claim had an authoritative repository-owned implementation or
generated source.

## Finding

### C18-DOC-001 — the public `YearMonth` type is broader than its documented runtime shape

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed** by an in-memory TypeScript compiler probe and the
  runtime guard
- Public type: `packages/core/src/analysis/context.ts:3`
- Runtime grammar and guard: `packages/core/src/analysis/context.ts:51-73`
- Runtime failure path: `packages/core/src/analysis/context.ts:80-83`
- Public root export: `packages/core/src/index.ts:27-42`
- Public subpath export: `packages/core/package.json:6-13`

The package exports:

```ts
type YearMonth = `${number}-${string}`;
```

That declaration communicates only “a numeric-looking prefix, a hyphen, then
any string.” The actual runtime contract is exactly four decimal year digits,
a hyphen, and a two-digit month from `01` through `12`.

The focused compiler probe accepted `2026-1`, `2026-99`, and `1-anything` as
`YearMonth` without a diagnostic. The module's `isYearMonth()` rejected all
three. A caller can therefore satisfy the public static API while
`previousCalendarMonth()` immediately throws, or place a statically accepted
value into exported `AnalysisContext`/`MonthlyBreakdown` structures that
runtime persistence later rejects.

Concrete neutral scenario: a TypeScript consumer constructs a month from
already split year/month text, assigns it to `YearMonth`, and passes it to the
exported predecessor helper. A missing zero in the month is not caught during
type checking even though the public type implies the value is ready for the
helper; the request fails only at runtime.

Root-cause fix:

1. Replace the loose template alias with an opaque/branded `YearMonth` whose
   values come from one exported parser/constructor.
2. Document the exact `YYYY-MM` grammar, valid month range, supported year
   domain, and failure behavior beside that constructor and the package
   export.
3. Make `isYearMonth()`, `yearMonthOfDate()`, and
   `previousCalendarMonth()` share that domain definition.
4. Add compile-time contract tests rejecting malformed literals and runtime
   round-trip/closure tests for valid values.

Novelty and merge disposition: tracked history owns exact previous-month
selection and ordinary January rollover, but contains no completed, deferred,
or rejected owner for the public alias accepting values rejected by its own
guard. Current Cycle 18 architect/debugger/verifier reports independently own
the reverse failure—valid admitted inputs can produce malformed low-year
outputs—and already recommend a brand as part of the root fix. C18-DOC-001 is
additional contract evidence for that same repair and should be merged into
the calendar-domain finding rather than scheduled independently.

## Required adjudications

### Publication identity and version wording

`scripts/catalog-publication.ts:113-132,391-409` accurately describes and
hashes the complete split browser runtime set: summary, optimizer, detail
shards, and categories. The active browser and default CLI readers consume
that set.

`scripts/build-json.ts:299-320,385-425` also copies the resulting hash and
version `1.0.0` into legacy full/compact catalogs whose ranking projections
are outside that hash. That metadata can therefore be misread as legacy
content identity even when legacy bytes change. No README or package API
currently defines independent legacy `sourceHash` or `version` semantics.

Disposition: no new documentation root. Archived Plan 80
(`C3-008`) explicitly promises a unique identity for every published catalog
byte set and a changed identity for a projection-only change. Reopen that
owner: either include legacy projections in an identity contract, give them
separate content hashes/schema versions, or remove unsupported legacy
identity metadata. Whichever policy is chosen should then be documented next
to the generated metadata and legacy artifact contract.

### Generated headers and README claims

- `apps/web/src/lib/category-labels-fallback.ts:1-3` and
  `apps/web/src/lib/category-labels.ts:21-22` correctly point maintainers to
  `bun run data:build`; `scripts/build-json.ts` is the orchestrating entry
  point even though serialization is factored into
  `scripts/category-label-publication.ts`.
- Root README toolchain, formats, local-first web behavior, remote-PDF
  consent, scraper environment/default/output/quarantine behavior, catalog
  counts, and build/check commands agree with the current manifests and help
  sources.
- CLI root/command examples, option availability, default report behavior,
  and `--version` output agree with the parsers and current `0.1.0` manifests.
- `.claude` data-generation guidance agrees with the current build and
  documentation scripts.

No mismatch was retained from these surfaces.

## Final missed-issue sweep

The closing pass rechecked stale counts and paths, copyable commands, option
names and defaults, local/remote privacy claims, supported input formats,
scraper issuers and publication workflow, generated-file ownership, package
exports and versions, catalog identity terminology, date-format terminology,
comments that promise validation or completeness, and current/archive
historical ownership.

No second current documentation/code mismatch survived implementation tracing
and history deduplication. The six protected untracked Cycle 42 artifacts were
excluded by exact path and were neither opened nor modified. The only write
from this role is this report.

Final document-specialist disposition: **one confirmed Low API-contract
mismatch, merged into the existing Cycle 18 calendar-domain root; zero
additional aggregate roots.**
