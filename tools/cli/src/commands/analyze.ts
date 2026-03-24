import { resolve } from 'node:path';
import { parseStatement } from '@cherrypicker/parser';
import { MerchantMatcher } from '@cherrypicker/core';
import { loadCategories } from '@cherrypicker/rules';
import type { RawTransaction } from '@cherrypicker/parser';
import type { CategorizedTransaction } from '@cherrypicker/core';
import { printSpendingSummary } from '@cherrypicker/viz';

const DEFAULT_CATEGORIES_PATH = resolve(
  new URL('../../../..', import.meta.url).pathname,
  'packages/rules/data/categories.yaml',
);

function parseArgs(args: string[]): { file: string; bank?: string; categoriesPath?: string } {
  const file = args[0];
  if (!file) {
    throw new Error('명세서 파일 경로를 지정하세요.\n  사용법: cherrypicker analyze <statement-file> [--bank <bankId>]');
  }

  let bank: string | undefined;
  let categoriesPath: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--bank' && args[i + 1]) {
      bank = args[i + 1];
      i++;
    } else if (args[i] === '--categories' && args[i + 1]) {
      categoriesPath = args[i + 1];
      i++;
    }
  }
  return { file, bank, categoriesPath };
}

export async function runAnalyze(args: string[]): Promise<void> {
  const { file, bank, categoriesPath } = parseArgs(args);

  console.log(`파일 분석 중: ${file}`);

  const parseResult = await parseStatement(file, bank ? { bank: bank as Parameters<typeof parseStatement>[1] extends { bank?: infer B } ? B : never } : undefined);

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

  const categorized: CategorizedTransaction[] = parseResult.transactions.map((tx: RawTransaction, idx: number) => {
    const match = matcher.match(tx.merchant, tx.category);
    return {
      id: `tx-${idx}`,
      date: tx.date,
      merchant: tx.merchant,
      amount: tx.amount,
      currency: 'KRW',
      installments: tx.installments,
      isOnline: tx.isOnline,
      rawCategory: tx.category,
      memo: tx.memo,
      category: match.category,
      subcategory: match.subcategory,
      confidence: match.confidence,
    };
  });

  printSpendingSummary(categorized);
}
