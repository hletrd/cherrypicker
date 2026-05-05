# Tracer — cherrypicker (Cycle 5)

**Reviewer:** tracer (sonnet)
**Scope:** Observability, traceability, debugging context
**Date:** 2026-05-05

---

## Summary

4 findings focused on runtime observability gaps. The recent fix velocity is high (FileDropzone, PDF scanner, reward calculator), but every fix was driven by manual inspection or user report rather than telemetry. No structured logging, no execution traces, no usage metrics.

---

## New Findings (Cycle 5)

### [P1-HIGH] Parser errors still lack file/format/line context

**Files:** `packages/parser/src/*/index.ts`
**Confidence:** High

Despite being flagged in cycle 4, parser errors are still plain `Error` or `throw new Error(string)` with no structured context. When `parseStatement()` fails in the web app, the caught error has no `format` or `filename` field to help the UI show a useful message.

**Evidence:**
- `packages/parser/src/pdf/index.ts:360` — pushes plain string to errors array: `errors.push('거래 내역을 찾을 수 없습니다.')`
- `packages/parser/src/csv/index.ts:89` — `throw new Error('CSV 헤더를 인식할 수 없습니다.')` with no file name
- `packages/parser/src/html/index.ts:56` — `throw new Error('표를 찾을 수 없습니다.')` with no URL or table index

**Fix:** Define `ParseError` class extending Error with `{ file, format, line, raw }` fields. Wrap all parser throws.

---

### [P1-HIGH] LLM fallback provides zero usage telemetry

**File:** `packages/parser/src/pdf/llm-fallback.ts:33-128`
**Confidence:** High

The LLM fallback sends text to Anthropic but returns only parsed transactions. No model name, no token count, no truncation flag, no latency. If costs spike, there is no data to investigate.

**Evidence:**
- Return type is `Promise<RawTransaction[]>` — no metadata wrapper
- `client.messages.create()` response (`message`) is discarded after extracting content
- Truncation at 8000 chars is silent — caller has no way to know data was lost

**Fix:** Change return to `{ transactions: RawTransaction[]; meta: { model, inputTokens, outputTokens, wasTruncated, durationMs } }`.

---

### [P2-MEDIUM] Optimizer returns no assignment rationale

**File:** `packages/core/src/optimizer/greedy.ts`
**Confidence:** High

The optimizer produces `OptimizationResult` with per-card totals but no trace of why each transaction was assigned to its card. Users (and developers) cannot audit the decision.

**Evidence:**
- `OptimizationResult` only contains `assignments: Record<string, Transaction[]>` and `totals`
- Per-transaction marginal reward comparison is computed at lines 124-156 but discarded

**Fix:** Add optional `trace?: AssignmentTrace[]` to `OptimizationResult` showing per-transaction candidate scores.

---

### [P2-MEDIUM] No correlation IDs across async boundaries

**Files:** Entire repo
**Confidence:** Medium

Multiple async operations (file upload → parse → categorize → optimize → report) have no shared correlation ID. Debugging a user-reported issue requires manual log correlation.

**Fix:** Introduce lightweight `Logger` interface with `traceId`. Pass logger through pipeline stages.

---

## Previously Reported — Status

| Finding | Cycle | Status | Notes |
|---------|-------|--------|-------|
| Parser errors lack file context | 4 | **OPEN** | Still plain Error throws |
| LLM fallback no token visibility | 4 | **OPEN** | No metadata returned |
| No structured logging | 4 | **OPEN** | No Logger interface introduced |
| Scraper no progress indication | 4 | **OPEN** | No progress callbacks added |

---

## Verdict

**FIX AND SHIP** — Add `ParseError` structured errors and LLM usage metadata. These are low-effort, high-value observability wins.
