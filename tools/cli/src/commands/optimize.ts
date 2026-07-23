import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MerchantMatcher, buildConstraints, optimize } from '@cherrypicker/core';
import { loadCategories, loadAllCardRules, buildCategoryLabelMap } from '@cherrypicker/rules';
import type { BankId } from '@cherrypicker/parser/types';
import { printCardComparison, printOptimizationResult } from '@cherrypicker/viz';
import {
  parsePreviousSpendingArgument,
  validateFilePath,
} from '../validation.js';
import { parseStatementLocalFirst } from '../parse-statement.js';
import { printOptimizationDisclosures } from '../disclosures.js';
import { formatParseWarning, sanitizeTerminalText } from '../terminal.js';
import {
  attachPerformanceIssues,
  calendarScopeWarnings,
  categorizeRawTransactions,
  prepareCliAnalysis,
} from '../analysis.js';

const DEFAULT_CATEGORIES_PATH = resolve(
  fileURLToPath(new URL('../../../..', import.meta.url)),
  'packages/rules/data/categories.yaml',
);
const DEFAULT_CARDS_DIR = resolve(
  fileURLToPath(new URL('../../../..', import.meta.url)),
  'packages/rules/data/cards',
);

function parseArgs(args: string[]): {
  file: string;
  cardsDir?: string;
  prevSpending?: number;
  bank?: string;
  categoriesPath?: string;
  allowRemoteLLM: boolean;
  yes: boolean;
} {
  const file = args[0];
  if (!file) {
    throw new Error(
      '명세서 파일 경로를 지정하세요.\n  사용법: cherrypicker optimize <statement-file> [--cards <dir>] [--prev-spending <amount>] [--allow-remote-llm] [--yes]',
    );
  }

  let cardsDir: string | undefined;
  let prevSpending: number | undefined;
  let bank: string | undefined;
  let categoriesPath: string | undefined;
  let allowRemoteLLM = false;
  let yes = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--cards' && args[i + 1]) {
      cardsDir = args[i + 1];
      i++;
    } else if (args[i] === '--prev-spending') {
      prevSpending = parsePreviousSpendingArgument(args[i + 1]);
      i++;
    } else if (args[i] === '--bank' && args[i + 1]) {
      bank = args[i + 1];
      i++;
    } else if (args[i] === '--categories' && args[i + 1]) {
      categoriesPath = args[i + 1];
      i++;
    } else if (args[i] === '--allow-remote-llm') {
      allowRemoteLLM = true;
    } else if (args[i] === '--yes') {
      yes = true;
    }
  }

  return { file, cardsDir, prevSpending, bank, categoriesPath, allowRemoteLLM, yes };
}

export async function runOptimize(args: string[]): Promise<void> {
  const { file, cardsDir, prevSpending, bank, categoriesPath, allowRemoteLLM, yes } = parseArgs(args);

  validateFilePath(file, { mustExist: true, label: '명세서 파일' });

  console.log(`파일 분석 중: ${sanitizeTerminalText(file)}`);

  const parseResult = await parseStatementLocalFirst({
    filePath: file,
    ...(bank ? { bank: bank as BankId } : {}),
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

  // Build category labels map for the optimizer
  const categoryLabels = buildCategoryLabelMap(categories);

  const categorized = categorizeRawTransactions(
    parseResult.transactions,
    matcher,
  );

  // Load card rules
  const resolvedCardsDir = cardsDir ?? DEFAULT_CARDS_DIR;
  const cardRules = await loadAllCardRules(resolvedCardsDir);
  if (cardRules.length === 0) {
    throw new Error('카드 규칙 파일을 찾을 수 없습니다. --cards 옵션으로 규칙 디렉토리를 지정하세요.');
  }
  console.log(`로드된 카드: ${cardRules.length}개`);

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

  printOptimizationDisclosures(
    result,
    prepared.context.previousSpendingBasis,
  );
  printCardComparison(result.cardResults);
  printOptimizationResult(result);
}
