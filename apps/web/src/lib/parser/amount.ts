/**
 * Web compatibility entrypoint for the canonical browser-safe amount parser.
 *
 * The shared implementation preserves accounting double-negative semantics:
 * `(-1234)` remains -1234 rather than being negated twice.
 */
export { parseAmount, parseAmountString } from '@cherrypicker/parser/browser';
