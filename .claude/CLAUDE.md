# cherrypicker — Korean Credit Card Optimizer

## Project Overview
Monorepo for analyzing Korean credit card statements and recommending optimal card usage per spending category.

## Tech Stack
- **Astro 6 + Svelte 5** — Web app (apps/web/, runs on Node 24)
- **Bun** — Data pipelines (packages/parser/, tools/scraper/, tools/cli/)
- **Pure TypeScript** — Shared packages (packages/core/, packages/rules/, packages/viz/)
- **Tailwind CSS 4** — Styling
- **Svelte 5 + SVG** — Repository-native charts
- **Zod** — Schema validation
- **Claude API** — PDF fallback parsing, card rule scraping

## Architecture
- `packages/core/` — Optimization engine (categorizer, calculator, optimizer). Pure TS, no runtime-specific APIs.
- `packages/parser/` — Custom TypeScript statement parsers for CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, and HTML/HTM. Runs on Bun; XLS uses SheetJS and PDF uses pdf-parse.
- `packages/rules/` — Card rule Zod schemas + YAML data files. Pure TS.
- `packages/viz/` — Terminal tables + HTML report generation. Pure TS.
- `tools/cli/` — CLI entry point. Runs on Bun.
- `tools/scraper/` — LLM-powered card rule scraper. Runs on Bun.
- `apps/web/` — Astro 6 + Svelte 5 static web app. Browser parsing uses the custom TypeScript parsers, SheetJS, and pdfjs-dist; builds on Node.

## Conventions
- Card rules stored as YAML in `packages/rules/data/cards/{issuer}/{card-name}.yaml`
- Category taxonomy in `packages/rules/data/categories.yaml`
- Merchant keywords are collected from four source files and normalized before matching.
- Conflicting canonical keyword mappings require an audited choice in `packages/core/src/categorizer/keyword-overrides.ts`; unresolved conflicts and stale strict-mode overrides fail matcher construction.
- All amounts in Korean Won (integer, no decimals)
- Dates in ISO 8601 format (YYYY-MM-DD)
