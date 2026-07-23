import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MerchantMatcher, buildConstraints, optimize } from '@cherrypicker/core';
import { loadCategories, buildCategoryLabelMap } from '@cherrypicker/rules';
import { printOptimizationResult, printSpendingSummary, generateHTMLReport } from '@cherrypicker/viz';
import { validateFilePath } from '../validation.js';
import { parseStatementLocalFirst } from '../parse-statement.js';
import { printOptimizationDisclosures } from '../disclosures.js';
import { formatParseWarning, sanitizeTerminalText } from '../terminal.js';
import {
  attachPerformanceIssues,
  calendarScopeWarnings,
  categorizeRawTransactions,
  prepareCliAnalysis,
} from '../analysis.js';
import {
  formatStatementCommandHelp,
  parseStatementCommandArgs,
} from '../command-options.js';
import { buildStandaloneReportContext } from '../report-context.js';
import { writeReportOutput } from '../report-output.js';
import {
  authoringCatalogDisclosure,
  loadCliCardCatalog,
} from '../card-catalog.js';

const DEFAULT_CATEGORIES_PATH = resolve(
  fileURLToPath(new URL('../../../..', import.meta.url)),
  'packages/rules/data/categories.yaml',
);
export async function runReport(args: string[]): Promise<void> {
  const options = parseStatementCommandArgs('report', args);
  if (options.help) {
    console.log(formatStatementCommandHelp('report'));
    return;
  }
  const {
    file,
    output,
    cardsDir,
    prevSpending,
    bank,
    categoriesPath,
    force,
    allowRemoteLLM,
    yes,
  } = options;

  validateFilePath(file, { mustExist: true, label: '명세서 파일' });
  validateFilePath(output, { mustExist: false, label: '출력 파일' });

  console.log(`파일 분석 중: ${sanitizeTerminalText(file)}`);

  const parseResult = await parseStatementLocalFirst({
    filePath: file,
    ...(bank ? { bank } : {}),
    allowRemoteLLM,
    yes,
  });

  if (parseResult.errors.length > 0) {
    console.warn('파싱 경고:');
    for (const e of parseResult.errors) {
      console.warn(formatParseWarning(e));
    }
  }

  // Categorize
  const catPath = categoriesPath ?? DEFAULT_CATEGORIES_PATH;
  const categories = await loadCategories(catPath);
  const matcher = new MerchantMatcher(categories);

  // Build category labels map for Korean display in reports
  const categoryLabels = buildCategoryLabelMap(categories);

  const categorized = categorizeRawTransactions(
    parseResult.transactions,
    matcher,
  );

  const cardCatalog = await loadCliCardCatalog(cardsDir);
  const authoringDisclosure = authoringCatalogDisclosure(cardCatalog);
  if (authoringDisclosure) {
    console.warn(sanitizeTerminalText(authoringDisclosure));
  }
  const cardRules = cardCatalog.cards;

  const prepared = prepareCliAnalysis(categorized, cardRules, prevSpending);
  for (const warning of calendarScopeWarnings(prepared.context)) {
    console.warn(sanitizeTerminalText(warning));
  }
  const constraints = buildConstraints(
    prepared.context.latestTransactions,
    prepared.cardPreviousSpending,
    categoryLabels,
  );
  const result = optimize(constraints, cardRules);
  attachPerformanceIssues(result, prepared.performanceIssues);

  // Print terminal summary
  printOptimizationDisclosures(
    result,
    prepared.context.previousSpendingBasis,
  );
  printSpendingSummary(prepared.context.latestTransactions, categoryLabels);
  printOptimizationResult(result);

  // Generate and write HTML report
  console.log(`\nHTML 보고서 생성 중...`);
  const html = generateHTMLReport(
    result,
    prepared.context.latestTransactions,
    categoryLabels,
    buildStandaloneReportContext({
      analysisContext: prepared.context,
      parseResult,
      result,
    }),
  );
  await writeReportOutput(output, html, { overwrite: force });
  console.log(`보고서 저장 완료: ${sanitizeTerminalText(output)}`);
}
