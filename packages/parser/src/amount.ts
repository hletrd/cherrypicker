/** Shared amount parsing utilities.
 *  Extracted from csv/shared.ts and xlsx/index.ts to provide a dedicated
 *  module for amount parsing, matching the web-side structure (C28-ARCH01).
 *
 *  Used by CSV, XLSX, PDF, HTML, and OFX parsers. */

export { parseAmount, parseAmountString } from './shared/amount.js';
