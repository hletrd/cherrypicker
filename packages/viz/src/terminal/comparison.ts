import Table from 'cli-table3';
import type { OptimizationResult } from '@cherrypicker/core';

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
  console.log('\n최적 카드 배정 결과');
  console.log('='.repeat(70));

  // Best card per category table
  const assignTable = new Table({
    head: ['카테고리', '추천카드', '혜택률', '예상혜택'],
    colAligns: ['left', 'left', 'right', 'right'],
    style: { head: ['cyan'] },
  });

  for (const a of result.assignments) {
    assignTable.push([
      a.categoryNameKo,
      a.assignedCardName,
      formatRate(a.rate),
      formatWon(a.reward),
    ]);
  }

  console.log(assignTable.toString());

  // Summary section
  console.log('\n요약');
  console.log('-'.repeat(50));
  console.log(`  총 지출액:          ${formatWon(result.totalSpending)}`);
  console.log(`  총 예상 혜택:       ${formatWon(result.totalReward)}`);
  console.log(`  유효 혜택률:        ${formatRate(result.effectiveRate)}`);
  console.log(
    `  단일 최적 카드:     ${result.bestSingleCard.cardName} (${formatWon(result.bestSingleCard.totalReward)})`,
  );
  console.log(
    `  다카드 추가 혜택:   ${formatWon(result.savingsVsSingleCard)} (${result.savingsVsSingleCard >= 0 ? '+' : ''}${formatRate(result.totalSpending > 0 ? result.savingsVsSingleCard / result.totalSpending : 0)})`,
  );

  // Caps hit warnings
  const allCaps = result.cardResults.flatMap((r) =>
    r.capsHit.map((c) => ({ cardName: r.cardName, ...c })),
  );

  if (allCaps.length > 0) {
    console.log('\n한도 도달 경고:');
    for (const cap of allCaps) {
      const lost = cap.actualReward - cap.appliedReward;
      console.log(
        `  [${cap.cardName}] ${cap.category}: 한도 ${formatWon(cap.capAmount)} 도달 — ${formatWon(lost)} 혜택 손실`,
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
        .map((alt) => `${alt.cardName} ${formatWon(alt.reward)} (${formatRate(alt.rate)})`)
        .join(', ');
      console.log(`  ${a.categoryNameKo}: ${altStr}`);
    }
  }

  console.log('');
}
