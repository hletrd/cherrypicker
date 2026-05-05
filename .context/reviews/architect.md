# Cycle 98 Architect Review

## A-01: OFX/QFX as New FileFormat [HIGH]

The `FileFormat` type currently has `'csv' | 'xlsx' | 'pdf' | 'json'`. Adding `'ofx'` requires:
1. Add `'ofx'` to `FileFormat` union type in `types.ts` (server + web)
2. Add `.ofx`/`.qfx` extension handling in `detectFormat`
3. Add XML/OFX content sniffing for unknown extensions
4. Create `packages/parser/src/ofx/index.ts` parser module
5. Add export in `packages/parser/src/index.ts`
6. Wire into `parseStatement` switch

OFX structure is well-defined: SGML tags with no closing delimiters for simple values. Parse with regex for `<DTPOSTED>`, `<TRNAMT>`, `<NAME>`, `<MEMO>`, `<TRNTYPE>`. Handle both 1.x (SGML) and 2.x (XML) variants.

## A-02: HTML Table as New FileFormat [HIGH]

Adding `'html'` requires:
1. Add `'html'` to `FileFormat` union type
2. Add `.html`/`.htm` extension handling in `detectFormat`
3. Create `packages/parser/src/html/index.ts` parser module
4. Reuse table detection from XLSX parser's `isHTMLContent` + SheetJS path
5. Wire into `parseStatement` switch

## A-03: BOM-aware Content Sniffing [LOW]

Strip BOM in `detectFormat` before JSON/XML content checks. Small fix to the sniff path.

## Deferred
- D-01: Confidence scoring on ParseResult
- D-02: Clipboard paste format
- D-03: Recursive JSON wrapper search