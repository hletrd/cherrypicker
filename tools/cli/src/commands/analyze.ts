import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MerchantMatcher } from '@cherrypicker/core';
import { loadCategories, buildCategoryLabelMap } from '@cherrypicker/rules';
import type { BankId, RawTransaction } from '@cherrypicker/parser';
import type { CategorizedTransaction } from '@cherrypicker/core';
import { printSpendingSummary } from '@cherrypicker/viz';
import { validateFilePath } from '../validation.js';
import { parseStatementLocalFirst } from '../parse-statement.js';

const DEFAULT_CATEGORIES_PATH = resolve(
  fileURLToPath(new URL('../../../..', import.meta.url)),
  'packages/rules/data/categories.yaml',
);

function parseArgs(args: string[]): {
  file: string;
  bank?: string;
  categoriesPath?: string;
  allowRemoteLLM: boolean;
  yes: boolean;
} {
  const file = args[0];
  if (!file) {
    throw new Error(
      '명세서 파일 경로를 지정하세요.\n  사용법: cherrypicker analyze <statement-file> [--bank <bankId>] [--allow-remote-llm] [--yes]',
    );
  }

  let bank: string | undefined;
  let categoriesPath: string | undefined;
  let allowRemoteLLM = false;
  let yes = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--bank' && args[i + 1]) {
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
  return { file, bank, categoriesPath, allowRemoteLLM, yes };
}

export async function runAnalyze(args: string[]): Promise<void> {
  const { file, bank, categoriesPath, allowRemoteLLM, yes } = parseArgs(args);

  validateFilePath(file, { mustExist: true, label: '명세서 파일' });

  console.log(`파일 분석 중: ${file}`);

  const parseResult = await parseStatementLocalFirst({
    filePath: file,
    ...(bank ? { bank: bank as BankId } : {}),
    allowRemoteLLM,
    yes,
  });

  if (parseResult.errors.length > 0) {
    console.warn('파싱 경고:');
    for (const e of parseResult.errors) {
      console.warn(`  ${e.line ? `[${e.line}행] ` : ''}${e.message}`);
    }
  }

  console.log(`\n감지된 은행: ${parseResult.bank ?? '알 수 없음'}`);
  console.log(`파싱된 거래 수: ${parseResult.transactions.length}건`);
  if (parseResult.statementPeriod) {
    console.log(`명세서 기간: ${parseResult.statementPeriod.start} ~ ${parseResult.statementPeriod.end}`);
  }
  if (parseResult.cardNumber) {
    console.log(`카드 번호: ${parseResult.cardNumber}`);
  }

  // Load categories and categorize
  const catPath = categoriesPath ?? DEFAULT_CATEGORIES_PATH;
  const categories = await loadCategories(catPath);
  const matcher = new MerchantMatcher(categories);

  // Build category labels map for Korean display in terminal output
  const categoryLabels = buildCategoryLabelMap(categories);

  const categorized: CategorizedTransaction[] = parseResult.transactions.map((tx: RawTransaction, idx: number) => {
    const match = matcher.match(tx.merchant, tx.category);
    return {
      id: `tx-${idx}`,
      date: tx.date,
      merchant: tx.merchant,
      amount: tx.amount,
      currency: 'KRW',
      installments: tx.installments,
      rawCategory: tx.category,
      memo: tx.memo,
      category: match.category,
      subcategory: match.subcategory,
      confidence: match.confidence,
    };
  });

  printSpendingSummary(categorized, categoryLabels);
}
