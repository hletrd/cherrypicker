import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { parseStatement } from '@cherrypicker/parser';
import { MerchantMatcher, buildConstraints, optimize } from '@cherrypicker/core';
import { loadCategories, loadAllCardRules } from '@cherrypicker/rules';
import type { RawTransaction } from '@cherrypicker/parser';
import type { CategorizedTransaction } from '@cherrypicker/core';
import { printOptimizationResult, printSpendingSummary, generateHTMLReport } from '@cherrypicker/viz';

const DEFAULT_CATEGORIES_PATH = resolve(
  new URL('../../../..', import.meta.url).pathname,
  'packages/rules/data/categories.yaml',
);
const DEFAULT_CARDS_DIR = resolve(
  new URL('../../../..', import.meta.url).pathname,
  'packages/rules/data/cards',
);

function parseArgs(args: string[]): {
  file: string;
  output: string;
  cardsDir?: string;
  prevSpending?: number;
  bank?: string;
  categoriesPath?: string;
  allowRemoteLLM: boolean;
} {
  const file = args[0];
  if (!file) {
    throw new Error(
      '명세서 파일 경로를 지정하세요.\n  사용법: cherrypicker report <statement-file> [--output <file.html>] [--allow-remote-llm]',
    );
  }

  let output = 'cherrypicker-report.html';
  let cardsDir: string | undefined;
  let prevSpending: number | undefined;
  let bank: string | undefined;
  let categoriesPath: string | undefined;
  let allowRemoteLLM = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1]!;
      i++;
    } else if (args[i] === '--cards' && args[i + 1]) {
      cardsDir = args[i + 1];
      i++;
    } else if (args[i] === '--prev-spending' && args[i + 1]) {
      prevSpending = parseInt(args[i + 1]!, 10);
      if (Number.isNaN(prevSpending) || prevSpending < 0) {
        throw new Error(`전월실적은 0 이상의 숫자여야 합니다: ${args[i + 1]}`);
      }
      i++;
    } else if (args[i] === '--bank' && args[i + 1]) {
      bank = args[i + 1];
      i++;
    } else if (args[i] === '--categories' && args[i + 1]) {
      categoriesPath = args[i + 1];
      i++;
    } else if (args[i] === '--allow-remote-llm') {
      allowRemoteLLM = true;
    }
  }

  return { file, output, cardsDir, prevSpending, bank, categoriesPath, allowRemoteLLM };
}

export async function runReport(args: string[]): Promise<void> {
  const { file, output, cardsDir, prevSpending, bank, categoriesPath, allowRemoteLLM } = parseArgs(args);

  console.log(`파일 분석 중: ${file}`);

  const parseResult = await parseStatement(file, {
    ...(bank
      ? { bank: bank as Parameters<typeof parseStatement>[1] extends { bank?: infer B } ? B : never }
      : {}),
    allowRemoteLLM,
  });

  if (parseResult.errors.length > 0) {
    console.warn('파싱 경고:');
    for (const e of parseResult.errors) {
      console.warn(`  ${e.line ? `[${e.line}행] ` : ''}${e.message}`);
    }
  }

  // Categorize
  const catPath = categoriesPath ?? DEFAULT_CATEGORIES_PATH;
  const categories = await loadCategories(catPath);
  const matcher = new MerchantMatcher(categories);

  // Build category labels map for Korean display in reports
  const categoryLabels = new Map<string, string>();
  for (const node of categories) {
    categoryLabels.set(node.id, node.labelKo);
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        categoryLabels.set(sub.id, sub.labelKo);
        // Dot-notation key for optimizer lookups — buildCategoryKey
        // produces "dining.cafe" but the taxonomy only has "cafe" as
        // the sub ID; without this entry, categoryLabels.get() misses.
        categoryLabels.set(`${node.id}.${sub.id}`, sub.labelKo);
      }
    }
  }

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

  // Load card rules and optimize
  const resolvedCardsDir = cardsDir ?? DEFAULT_CARDS_DIR;
  const cardRules = await loadAllCardRules(resolvedCardsDir);
  if (cardRules.length === 0) {
    throw new Error('카드 규칙 파일을 찾을 수 없습니다. --cards 옵션으로 규칙 디렉토리를 지정하세요.');
  }

  const cardPreviousSpending = new Map<string, number>();
  if (prevSpending !== undefined) {
    for (const rule of cardRules) {
      cardPreviousSpending.set(rule.card.id, prevSpending);
    }
  }
  const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);
  const result = optimize(constraints, cardRules);

  // Print terminal summary
  printSpendingSummary(categorized, categoryLabels);
  printOptimizationResult(result);

  // Generate and write HTML report
  console.log(`\nHTML 보고서 생성 중...`);
  const html = generateHTMLReport(result, categorized, categoryLabels);
  writeFileSync(output, html, 'utf-8');
  console.log(`보고서 저장 완료: ${output}`);
}
