# Architect Review -- Cycle 33

## F-04 Architecture Note: findColumn combined-header handling

The `findColumn` function in `column-matcher.ts` should split headers on "/" and "-" delimiters before regex matching. This is a targeted change to `findColumn` only — no structural changes needed.

## Web/Server Parity Summary

After 33 cycles, the server-side adapter-factory architecture is clean. Web-side CSV bank adapters remain a deferred item (D-01). The key parity gaps this cycle are:
- "마이너스" prefix: server-side only
- Won-sign PDF amounts: web-side only
- Combined headers: neither side handles

No new architectural debt introduced.