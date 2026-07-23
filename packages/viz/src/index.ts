export { printSpendingSummary, printCardComparison } from './terminal/summary.js';
export { printOptimizationResult } from './terminal/comparison.js';
export { sanitizeTerminalText } from './terminal/sanitize.js';
export { generateHTMLReport } from './report/generator.js';
export {
  GROSS_MONTHLY_REWARD_DISCLOSURE_KO,
  GROSS_MONTHLY_REWARD_LABEL_KO,
} from './reward-disclosure.js';
export type {
  StandaloneReportCalendarExclusion,
  StandaloneReportContext,
  StandaloneReportParseExclusion,
} from './report/generator.js';
