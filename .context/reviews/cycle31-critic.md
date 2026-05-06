# Cycle 31 Critic Review

**Scope:** Multi-perspective critique of the change surface, design decisions, and trade-offs.

---

## Observations

### C31-CRIT01 | The web/server parser duplication continues to grow

With HTML, OFX, and JSON parsers now duplicated, the codebase has ~2000 lines of near-identical parser code across two directories. The "parity" commits (C98, C99, C100) are a symptom, not a solution. Each new parser format increases the duplication tax. The deferred item D-01 (HIGH severity) has been open since cycle 1 and is now more expensive to fix than ever.

**Suggestion:** Pause adding new parser formats until D-01 is addressed. The marginal value of supporting additional formats is decreasing while the maintenance cost is increasing linearly.

### C31-CRIT02 | The forward-fill pattern is elegant but over-applied

Forward-fill (carrying values from previous rows into empty cells) is correct for merged cells in Korean bank exports. However, applying it to ALL columns (date, merchant, category, installments, memo, amount) assumes that Korean banks merge all these column types equally. In practice, only date and merchant are commonly merged. The extra forward-fill logic for category/installments/memo adds complexity without clear benefit.

**Suggestion:** Profile real Korean bank HTML/XLSX exports to determine which columns actually need forward-fill, then simplify the logic.

### C31-CRIT03 | The LLM fallback is a "hope for the best" strategy

The PDF LLM fallback truncates at 8000 chars, hopes the LLM returns valid JSON, and then tries progressively shorter JSON matches if the first parse fails. This is a reasonable fallback but it's not a robust parsing strategy. If the LLM hallucinates transactions or omits real ones, the user has no way to verify correctness.

**Suggestion:** Add a confidence threshold or require user confirmation before accepting LLM-parsed transactions.

### C31-CRIT04 | Review focus is drifting toward edge cases

After 30+ review cycles, the codebase is well-hardened. New findings are increasingly edge-casey (e.g., `parseFloat('1-2-3')` returns `1`). The review overhead may exceed the value of findings at this point. Consider shifting review focus to:
- Architectural debt reduction (D-01)
- User-reported issues
- Performance under realistic load

---

## Prior Open Findings

| Finding | Status | Assessment |
|---|---|---|
| D-01 | OPEN (HIGH) | More urgent now with 6 duplicated parser formats |
| D-06 | OPEN (MEDIUM) | Still relevant — generic CSV handling is acceptable but not ideal |
| C8-07 | OPEN (LOW) | build-stats fallbacks are a minor UX papercut, not critical |
