/**
 * Browser-safe parser primitives. This entrypoint must remain free of Node
 * filesystem imports and remote-LLM SDKs.
 */
export type { BankId, FileFormat } from './types.js';
export {
  BANK_COLUMN_CONFIGS,
  getBankColumnConfig,
  type ColumnConfig,
} from './xlsx/adapters/index.js';
export {
  createBoundedDiagnosticArray,
  MAX_PARSE_DIAGNOSTICS,
  MAX_PARSE_DIAGNOSTIC_EXAMPLES,
  MAX_PARSE_DIAGNOSTIC_MESSAGE_LENGTH,
  MAX_PARSE_DIAGNOSTIC_RAW_LENGTH,
  PARSE_DIAGNOSTICS_OMITTED_ERROR_CODE,
  PARSE_DIAGNOSTICS_OMITTED_MESSAGE,
  truncateParseDiagnosticRaw,
  type BoundedParseDiagnostic,
} from './shared/diagnostics.js';
export { parseAmount, parseAmountString } from './shared/amount.js';
export {
  AMBIGUOUS_AMOUNT_ERROR_CODE,
  AMBIGUOUS_AMOUNT_MESSAGE,
  classifyAmountFieldName,
  compileAmountFieldPlan,
  NON_SPENDING_AMOUNT_ERROR_CODE,
  nonSpendingAmountMessage,
  normalizeResolvedSpendingAmount,
  resolveAmountField,
  withInferredNeutralAmountField,
  type AmountFieldCandidate,
  type AmountFieldPlan,
  type AmountFieldResolution,
  type AmountFieldRole,
} from './shared/amount-fields.js';
export {
  detectAndDecodeStatementTextBytes,
  decodeStatementTextBytes,
  decodeTextBytes,
  detectStatementTextEncoding,
  detectTextEncoding,
  UnsupportedTextEncodingError,
  type StatementTextFormat,
  type StatementTextDecodeResult,
  type SupportedTextEncoding,
} from './shared/encoding.js';
export {
  MAX_REQUIRED_FIELD_ROW_ERRORS,
  missingRequiredColumnLabels,
  normalizeRequiredMerchant,
  REQUIRED_DATE_ERROR_CODE,
  REQUIRED_DATE_ERROR_MESSAGE,
  REQUIRED_MERCHANT_ERROR_CODE,
  REQUIRED_MERCHANT_ERROR_MESSAGE,
  REQUIRED_TRANSACTION_COLUMNS,
} from './shared/required-fields.js';
export {
  extractOFXTag,
  extractOFXTransactionBlocks,
  parseOFXDateToISO,
  resolveOFXStatementCurrency,
  type OFXStatementCurrencyResult,
  type OFXTransactionBlock,
} from './shared/ofx.js';
export {
  DELIMITER_SAMPLE_CHARACTER_LIMIT,
  DELIMITER_SAMPLE_LINE_LIMIT,
  detectDelimitedTextDelimiter,
  sampleNonEmptyDelimitedLines,
  splitDelimitedRecord,
  splitDelimitedRecords,
  splitDelimitedRecordsWithLines,
  type DelimitedLogicalRecord,
  type DelimiterLineSample,
} from './shared/delimiter.js';
export {
  HTML_XLS_SNIFF_BYTES,
  STATEMENT_FORMAT_SNIFF_BYTES,
  detectStatementFormatFromExtension,
  detectStatementFormatHint,
  finalizeStatementFormatHint,
  isHTMLStatementBytes,
  type BrowserSafeStatementFormat,
  type StatementFormatHint,
  type StatementTextPrefixDecoder,
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
export {
  MAX_JSON_PARSE_DIAGNOSTICS,
  parseJSONTransactions,
} from './shared/json.js';
export type {
  JSONParseDiagnostic,
  JSONParseKernelResult,
  JSONTransaction,
} from './shared/json.js';
export {
  MAX_XLSX_ARCHIVE_ENTRIES,
  MAX_XLSX_COMPRESSED_BYTES,
  MAX_XLSX_COMPRESSION_RATIO,
  MAX_XLSX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES,
  preflightXLSXArchive,
  XLSX_ARCHIVE_REJECTED_ERROR_CODE,
  XLSX_ARCHIVE_REJECTED_MESSAGE,
  XLSXArchiveValidationError,
  type XLSXArchivePreflightResult,
  type XLSXArchiveRejectionReason,
} from './shared/xlsx-archive.js';
