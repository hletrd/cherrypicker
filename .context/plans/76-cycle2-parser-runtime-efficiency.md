# Plan 76 — Cycle 2 Parser Runtime Efficiency

**Findings:** C2-014, C2-015
**Deploy mode:** none
**Status:** completed

## Outcome

Keep local statement dispatch dependency-light and read a statement’s complete
contents only once.

## Tasks

- [x] Add a lightweight statement-dispatch entry that dynamically imports only
  the selected adapter; keep concrete parsers and remote PDF fallback opt-in.
- [x] Separate dependency-light types/detection from the broad convenience
  entry and update CLI imports to use the dispatcher.
- [x] Read statement bytes once, pass a bounded prefix to pure detection, and
  reuse the same bytes/content in the selected parser. Avoid complete reads
  during format sniffing.
- [x] Add import-graph coverage proving CSV dispatch cannot reach XLSX, PDF, or
  Anthropic, plus injected-read tests proving one full CSV read and bounded
  unknown-extension sniffing.

## Acceptance

- [x] A fresh CSV CLI parse does not load the PDF/Anthropic graph.
- [x] Known CSV input performs exactly one full file read.
- [x] Parser and CLI behavior remains byte-for-byte compatible for fixtures.
- [x] Bundle/import-graph, parser, CLI, lint, and typecheck gates pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C2-014 | lazy dispatcher and server import-graph regression |
| C2-015 | single-read orchestration regression |
