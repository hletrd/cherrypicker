# Tracer — cherrypicker (Cycle 18)

**Reviewer:** tracer
**Scope:** Observability, traceability, debugging context, causal flow
**Date:** 2026-05-06

---

## Summary

ParseError class with context fields is now used consistently across server-side parsers. Web-side ParseError class parity was achieved. LLM fallback still provides zero usage telemetry. Optimizer still returns no assignment rationale. No correlation IDs exist across async boundaries.

---

## New Findings

None. All observability gaps were previously reported and remain in the same state.

---

## Previously Reported — Status

| Finding | Cycle | Status | Notes |
|---------|-------|--------|-------|
| Parser errors lack file context | 4 | **MITIGATED** | Server-side now uses ParseError with file/format. Web-side has class parity but parsers don't always pass file context. |
| LLM fallback no token visibility | 4 | **OPEN** | `parsePDFWithLLM` returns `RawTransaction[]` only; no metadata wrapper |
| No structured logging | 4 | **OPEN** | No Logger interface introduced |
| Optimizer no assignment rationale | 5 | **OPEN** | `OptimizationResult` lacks trace field |
| No correlation IDs | 5 | **OPEN** | No traceId across pipeline stages |

---

## Verdict

**NO CHANGE** — Observability gaps persist at prior severity levels. No new tracing issues found.
