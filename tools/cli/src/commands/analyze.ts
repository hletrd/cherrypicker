import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MerchantMatcher } from '@cherrypicker/core';
import { loadCategories, buildCategoryLabelMap } from '@cherrypicker/rules';
import { printSpendingSummary } from '@cherrypicker/viz';
import { validateFilePath } from '../validation.js';
import { parseStatementLocalFirst } from '../parse-statement.js';
import { formatParseWarning, sanitizeTerminalText } from '../terminal.js';
import { categorizeRawTransactions } from '../analysis.js';
import {
  formatStatementCommandHelp,
  parseStatementCommandArgs,
} from '../command-options.js';

const DEFAULT_CATEGORIES_PATH = resolve(
  fileURLToPath(new URL('../../../..', import.meta.url)),
  'packages/rules/data/categories.yaml',
);

export async function runAnalyze(args: string[]): Promise<void> {
  const options = parseStatementCommandArgs('analyze', args);
  if (options.help) {
    console.log(formatStatementCommandHelp('analyze'));
    return;
  }
  const { file, bank, categoriesPath, allowRemoteLLM, yes } = options;

  validateFilePath(file, { mustExist: true, label: '명세서 파일' });

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

  console.log(`\n감지된 은행: ${parseResult.bank ?? '알 수 없음'}`);
  console.log(`파싱된 거래 수: ${parseResult.transactions.length}건`);
  if (parseResult.statementPeriod) {
    console.log(`명세서 기간: ${parseResult.statementPeriod.start} ~ ${parseResult.statementPeriod.end}`);
  }
  if (parseResult.cardNumber) {
    console.log(`카드 번호: ${sanitizeTerminalText(parseResult.cardNumber)}`);
  }

  // Load categories and categorize
  const catPath = categoriesPath ?? DEFAULT_CATEGORIES_PATH;
  const categories = await loadCategories(catPath);
  const matcher = new MerchantMatcher(categories);

  // Build category labels map for Korean display in terminal output
  const categoryLabels = buildCategoryLabelMap(categories);

  const categorized = categorizeRawTransactions(
    parseResult.transactions,
    matcher,
  );

  printSpendingSummary(categorized, categoryLabels);
}
