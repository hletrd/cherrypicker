/**
 * Browser-safe parser primitives. This entrypoint must remain free of Node
 * filesystem imports and remote-LLM SDKs.
 */
export { parseAmount, parseAmountString } from './shared/amount.js';
export {
  decodeTextBytes,
  detectTextEncoding,
  type SupportedTextEncoding,
} from './shared/encoding.js';
export {
  DELIMITER_SAMPLE_LINE_LIMIT,
  detectDelimitedTextDelimiter,
  sampleNonEmptyDelimitedLines,
  type DelimiterLineSample,
} from './shared/delimiter.js';
export {
  STATEMENT_FORMAT_SNIFF_BYTES,
  detectStatementFormatFromExtension,
  detectStatementFormatHint,
  finalizeStatementFormatHint,
  type BrowserSafeStatementFormat,
  type StatementFormatHint,
} from './shared/format-detection.js';
export { parseDateCell, type DateCellResult } from './shared/date-cell.js';
export {
  createSheetMergeIndex,
  isNonEmptySheetCell,
  resolveSheetCell,
  type ResolvedSheetCell,
  type SheetMergeIndex,
  type SheetPoint,
  type SheetRange,
} from './shared/sheet-cells.js';
export {
  findLastPDFAmountToken,
  parsePDFText,
  resolvePDFRowValues,
  type PDFAmountToken,
  type PDFCellMatch,
  type PDFRowValues,
} from './shared/pdf-text.js';
export {
  daysInMonth,
  inferYear,
  isValidDayForMonth,
  isValidISODate,
  isValidShortDate,
  isValidYYMMDD,
  isValidYYYYMMDD,
  parseDateStringToISO,
} from './date-utils.js';
export {
  extractTransactionFacts,
  isValidFuelVolumeLiters,
  MAX_CONSUMER_FUEL_VOLUME_LITERS,
  PERFORMANCE_EXCLUSION_TAGS,
} from './shared/transaction-facts.js';
export type {
  ExtractedTransactionFacts,
  ParsedFactKey,
  ParsedFactSource,
  ParsedPerformanceExclusionTag,
  ParsedTransactionFacts,
} from './shared/transaction-facts.js';
export { parseJSONTransactions } from './shared/json.js';
export type {
  JSONParseDiagnostic,
  JSONParseKernelResult,
  JSONTransaction,
} from './shared/json.js';
