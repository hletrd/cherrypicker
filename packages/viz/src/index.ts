export { printSpendingSummary, printCardComparison } from './terminal/summary.js';
export { printOptimizationResult } from './terminal/comparison.js';
export { sanitizeTerminalText } from './terminal/sanitize.js';
export { generateHTMLReport } from './report/generator.js';
export type {
  StandaloneReportCalendarExclusion,
  StandaloneReportContext,
  StandaloneReportParseExclusion,
} from './report/generator.js';
