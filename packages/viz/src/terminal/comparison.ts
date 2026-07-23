import Table from 'cli-table3';
import type { OptimizationResult } from '@cherrypicker/core';
import { sanitizeTerminalText } from './sanitize.js';
import {
  GROSS_MONTHLY_REWARD_DISCLOSURE_KO,
  GROSS_MONTHLY_REWARD_LABEL_KO,
} from '../reward-disclosure.js';
import { formatCapOutcomeKo } from '../cap-disclosure.js';

function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  // Normalize negative zero to positive zero so we never render "-0원"
  if (amount === 0) amount = 0;
  return `${amount.toLocaleString('ko-KR')}원`;
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '0.00%';
  return `${(rate * 100).toFixed(2)}%`;
}

export function printOptimizationResult(result: OptimizationResult): void {
  console.log('\n추천 카드 배정 결과');
  console.log('='.repeat(70));
  console.log(GROSS_MONTHLY_REWARD_DISCLOSURE_KO);

  // Best card per category table
  const assignTable = new Table({
    head: [
      '카테고리',
      '추천카드',
      '월간 혜택률',
      '연회비 차감 전 월간 혜택',
    ],
    colAligns: ['left', 'left', 'right', 'right'],
    style: { head: ['cyan'] },
  });

  for (const a of result.assignments) {
    assignTable.push([
      sanitizeTerminalText(a.categoryNameKo),
      sanitizeTerminalText(a.assignedCardName),
      formatRate(a.rate),
      formatWon(a.reward),
    ]);
  }

  if (result.assignments.length > 0) {
    console.log(assignTable.toString());
  } else {
    console.log('  계산 가능한 양의 혜택이 없어 추천 카드 배정이 없습니다.');
  }

  // Summary section
  console.log('\n요약');
  console.log('-'.repeat(50));
  console.log(`  총 지출액:          ${formatWon(result.totalSpending)}`);
  if (result.unassignedTransactionCount > 0) {
    console.log(
      `  혜택 미배정 지출:   ${formatWon(result.unassignedSpending)} (${result.unassignedTransactionCount.toLocaleString('ko-KR')}건, 계산 가능한 양의 혜택 없음)`,
    );
  }
  console.log(`  ${GROSS_MONTHLY_REWARD_LABEL_KO}: ${formatWon(result.totalReward)}`);
  console.log(`  연회비 차감 전 혜택률: ${formatRate(result.effectiveRate)}`);
  if (result.bestSingleCard) {
    console.log(
      `  단일 카드 월간 총혜택: ${sanitizeTerminalText(result.bestSingleCard.cardName)} (${formatWon(result.bestSingleCard.totalReward)}, 연회비 차감 전)`,
    );
    console.log(
      `  단일 카드 대비 월간 혜택 차이: ${formatWon(result.savingsVsSingleCard)} (${result.savingsVsSingleCard >= 0 ? '+' : ''}${formatRate(result.totalSpending > 0 ? result.savingsVsSingleCard / result.totalSpending : 0)}, 연회비 차감 전)`,
    );
  } else {
    console.log('  단일 카드 월간 총혜택: 계산 가능한 양의 혜택 없음');
    console.log('  단일 카드 대비 월간 혜택 차이: 비교할 양의 혜택 없음');
  }

  // Caps hit warnings
  const allCaps = result.cardResults.flatMap((r) =>
    r.capsHit.map((c) => ({ cardName: r.cardName, ...c })),
  );

  if (allCaps.length > 0) {
    console.log('\n한도 도달 경고:');
    for (const cap of allCaps) {
      console.log(
        `  [${sanitizeTerminalText(cap.cardName)}] ${sanitizeTerminalText(cap.category)}: 한도 ${formatWon(cap.capAmount)} 도달 — ${formatCapOutcomeKo(cap, formatWon)}`,
      );
    }
  }

  // Alternatives info
  const hasAlts = result.assignments.some((a) => a.alternatives.length > 0);
  if (hasAlts) {
    console.log('\n대안 카드:');
    for (const a of result.assignments) {
      if (a.alternatives.length === 0) continue;
      const altStr = a.alternatives
        .map((alt) => `${sanitizeTerminalText(alt.cardName)} ${formatWon(alt.reward)} (${formatRate(alt.rate)})`)
        .join(', ');
      console.log(`  ${sanitizeTerminalText(a.categoryNameKo)}: ${altStr}`);
    }
  }

  console.log('');
}
