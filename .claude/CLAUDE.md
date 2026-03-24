# cherrypicker — Korean Credit Card Optimizer

## Project Overview
Monorepo for analyzing Korean credit card statements and recommending optimal card usage per spending category.

## Tech Stack
- **Astro 6 + Svelte 5** — Web app (apps/web/, runs on Node 24)
- **Bun** — Data pipelines (packages/parser/, tools/scraper/, tools/cli/)
- **Pure TypeScript** — Shared packages (packages/core/, packages/rules/, packages/viz/)
- **Tailwind CSS 4** — Styling
- **LayerChart + D3** — Charts
- **Zod** — Schema validation
- **Claude API** — PDF fallback parsing, card rule scraping

## Architecture
- `packages/core/` — Optimization engine (categorizer, calculator, optimizer). Pure TS, no runtime-specific APIs.
- `packages/parser/` — Statement parsers (CSV, XLSX, PDF). Runs on Bun.
- `packages/rules/` — Card rule Zod schemas + YAML data files. Pure TS.
- `packages/viz/` — Terminal tables + HTML report generation. Pure TS.
- `tools/cli/` — CLI entry point. Runs on Bun.
- `tools/scraper/` — LLM-powered card rule scraper. Runs on Bun.
- `apps/web/` — Astro 6 + Svelte 5 full-stack web app. Runs on Node.

## Conventions
- Card rules stored as YAML in `packages/rules/data/cards/{issuer}/{card-name}.yaml`
- Category taxonomy in `packages/rules/data/categories.yaml`
- Korean text used for merchant matching keywords
- All amounts in Korean Won (integer, no decimals)
- Dates in ISO 8601 format (YYYY-MM-DD)
