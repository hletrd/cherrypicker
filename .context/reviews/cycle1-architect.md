# Architect Review — Cycle 1 (architect)

## Scope
Full repository review focusing on architectural risks, coupling, and layering.

---

## C1-AR-01: Server and web parser packages are fully duplicated — no shared module
**Severity: High | Confidence: High**

The parser logic exists in TWO completely separate implementations:
- `packages/parser/` — Server-side (Bun runtime)
- `apps/web/src/lib/parser/` — Web-side (browser runtime)

These share zero code. Each has its own:
- Bank adapter implementations (10 adapters duplicated)
- Generic CSV parser
- XLSX parser
- PDF parser
- Date utilities
- Type definitions
- Bank detection logic

The web-side `csv.ts` even has a comment acknowledging this: "NOTE(C70-04): The helpers below duplicate logic from packages/parser/src/csv/shared.ts. Full dedup requires the D-01 architectural refactor (shared module between Bun and browser environments)."

**Impact**: Every bug fix, feature addition, or format support improvement must be implemented twice. The two implementations have already diverged (web-side has more header keywords, BOM stripping, better header detection).

**Fix**: Create a shared `packages/parser-common/` package with pure-logic code (no Node/Bun/DOM APIs). Use this in both the server parser and web parser.

---

## C1-AR-02: Bank adapter interface too narrow — only CSV and XLSX
**Severity: Medium | Confidence: High**

`packages/parser/src/types.ts` line 36-41:
```typescript
export interface BankAdapter {
  bankId: BankId;
  detect(content: string): boolean;
  parseCSV?(content: string): ParseResult;
  parseXLSX?(rows: unknown[][]): ParseResult;
}
```

There's no `parsePDF` method on the adapter. PDF parsing uses a completely separate path (`pdf/index.ts`) with no bank-specific customization. This means bank-specific PDF parsing strategies can't be plugged in.

**Fix**: Extend the adapter interface with `parsePDF?(text: string): ParseResult | null`.

---

## C1-AR-03: XLSX column configs defined in a separate file from CSV adapters
**Severity: Medium | Confidence: High**

XLSX bank column configs are in `packages/parser/src/xlsx/adapters/index.ts` while CSV bank column configs are hardcoded in each CSV adapter file. These should be a single shared configuration.

**Fix**: Create a shared `BankColumnConfig` that both CSV and XLSX parsers reference.

---

## C1-AR-04: `BankId` type union has 24 entries but only 10 have CSV adapters
**Severity: Low | Confidence: High**

The `BankId` type includes 24 banks, but only 10 have bank-specific CSV adapters. The remaining 14 (kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost) fall through to the generic parser. The XLSX adapter index has configs for all 24, showing awareness of the gap.

**Impact**: Low — the generic parser handles these, but bank-specific adapters would provide more reliable parsing.