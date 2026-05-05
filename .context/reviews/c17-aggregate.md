# Cycle 17 — Aggregate Review

Deduplicated findings across `c17-code-reviewer.md`, `c17-security-reviewer.md`, `c17-perf-reviewer.md`, `c17-test-engineer.md`, `c17-architect.md`, `c17-debugger.md`, `c17-verifier.md`, `c17-tracer.md`, `c17-critic.md`, `c17-document-specialist.md`, `c17-designer.md`.

## NEW — in-scope for cycle 17

| Id | Source agents | File:line | Severity | Description |
|----|---------------|-----------|----------|-------------|
| C17-01 | code-reviewer CR01, architect ARCH01, debugger DEBUG01, verifier VER01, tracer | `packages/parser/src/pdf/index.ts:318` | **MEDIUM** | **Server-side PDF fallback trailing-minus capture group broken** — regex has `([\d,]*(?:,|\d{5,})[\d,]*)-` (minus outside group) while web-side has `([\d,]*(?:,|\d{5,})[\d,]*-)` (minus inside). Server passes "1,234" to parseAmountString which returns positive 1234. Web passes "1,234-" to parseAmount which returns -1234. Parity bug. |
| C17-02 | code-reviewer CR02, security-reviewer SEC02, verifier VER02, tracer | `apps/web/src/lib/parser/json.ts:58`, `packages/parser/src/json/index.ts:65` | **MEDIUM** | **`findField` uses `in` operator** — traverses prototype chain. Fix: `Object.hasOwn(obj, alias)`. |
| C17-03 | code-reviewer CR03, security-reviewer SEC03, architect ARCH03, verifier VER03 | `apps/web/src/lib/store.svelte.ts:115` | **LOW** | **`MIGRATIONS` uses `any` type** — replace with `unknown` and add runtime validation. |
| C17-04 | code-reviewer CR04, debugger DEBUG02, document-specialist DOC03 | `apps/web/src/lib/parser/html.ts:27`, `packages/parser/src/csv/shared.ts:180` | **LOW** | **`normalizeHTML` only handles 6 tags** — broaden regex to handle any malformed closing tag. |
| C17-05 | code-reviewer CR05, CR06 | `apps/web/src/lib/parser/pdf.ts:246`, `packages/parser/src/csv/shared.ts:142` | **LOW** | **Missing full-width plus sign `＋` handling** — add `.replace(/＋/g, '+')` to parseAmount and parseAmountString. |
| C17-06 | test-engineer TEST01 | `packages/parser/__tests__/` | **MEDIUM** | **Missing test for trailing-minus in server PDF fallback** — add test for "1,234-" parsing as negative. |
| C17-07 | test-engineer TEST02 | `packages/parser/__tests__/json.test.ts` | **LOW** | **Missing test for `findField` prototype safety** — add test with polluted prototype. |
| C17-08 | test-engineer TEST03 | `packages/parser/__tests__/csv-shared.test.ts` | **LOW** | **Missing test for full-width plus sign** — add test for `＋1,234원`. |
| C17-09 | test-engineer TEST04 | `packages/parser/__tests__/html.test.ts` | **LOW** | **Missing test for `normalizeHTML` with div/span/p** — add broader malformed tag tests. |
| C17-10 | designer UI01 | `apps/web/src/components/upload/FileDropzone.svelte:97` | **LOW** | **HTML upload lacks content-sniffing validation** — validate HTML structure before parsing. |
| C17-11 | designer UI02 | `apps/web/src/lib/store.svelte.ts:135` | **LOW** | **Persistence warnings may not be actionable** — review UI strings for clarity. |

## Carry-overs from previous cycles

No carry-overs scheduled for implementation this cycle. Previous deferred items remain in their respective plan documents.

## Cross-agent agreement

- **C17-01**: 5 agents (code-reviewer, architect, debugger, verifier, tracer) — highest signal
- **C17-02**: 4 agents (code-reviewer, security-reviewer, verifier, tracer) — strong signal
- **C17-03**: 4 agents (code-reviewer, security-reviewer, architect, verifier) — strong signal

## AGENT FAILURES

None. All 11 review agents completed successfully.
