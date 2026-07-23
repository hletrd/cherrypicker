import Table from 'cli-table3';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { CardRewardResult } from '@cherrypicker/core';
import { sanitizeTerminalText } from './sanitize.js';
import { aggregatePositiveSpending } from '../spending-aggregation.js';

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

export function printSpendingSummary(transactions: CategorizedTransaction[], categoryLabels: Map<string, string>): void {
  const {
    categories,
    grandTotal,
    includedCount,
  } = aggregatePositiveSpending(transactions, categoryLabels);
  const rows = categories.sort((a, b) => b.total - a.total);

  const table = new Table({
    head: ['카테고리', '지출액', '건수', '비중(%)'],
    colAligns: ['left', 'right', 'right', 'right'],
    style: { head: ['cyan'] },
  });

  for (const row of rows) {
    const pct = grandTotal > 0 ? ((row.total / grandTotal) * 100).toFixed(1) : '0.0';
    table.push([
      sanitizeTerminalText(row.labelKo),
      formatWon(row.total),
      String(row.count),
      `${pct}%`,
    ]);
  }

  // Total row — use includedCount instead of transactions.length so the count
  // reflects only the positive-amount transactions that contributed to grandTotal,
  // matching the fix applied to the HTML report generator (C3-01/C4-01).
  table.push([
    '합계',
    formatWon(grandTotal),
    String(includedCount),
    grandTotal > 0 ? '100.0%' : '0.0%',
  ]);

  console.log('\n지출 내역 요약');
  console.log('='.repeat(60));
  console.log(table.toString());
}

export function printCardComparison(results: CardRewardResult[]): void {
  const sorted = [...results].sort((a, b) => b.totalReward - a.totalReward);

  const table = new Table({
    head: [
      '카드명',
      '연회비 차감 전 월간 총혜택',
      '연회비 차감 전 혜택률',
      '전월실적 구간',
    ],
    colAligns: ['left', 'right', 'right', 'left'],
    style: { head: ['cyan'] },
  });

  for (const r of sorted) {
    table.push([
      sanitizeTerminalText(r.cardName),
      formatWon(r.totalReward),
      formatRate(r.effectiveRate),
      sanitizeTerminalText(r.performanceTier),
    ]);
  }

  console.log('\n카드별 월간 총혜택 비교 (연회비 차감 전)');
  console.log('='.repeat(60));
  console.log(table.toString());

  // Caps hit warnings
  const capped = sorted.filter((r) => r.capsHit.length > 0);
  if (capped.length > 0) {
    console.log('\n한도 도달 경고:');
    for (const r of capped) {
      for (const cap of r.capsHit) {
        const lost = cap.actualReward - cap.appliedReward;
        console.log(
          `  [${sanitizeTerminalText(r.cardName)}] ${sanitizeTerminalText(cap.category)}: 한도 ${formatWon(cap.capAmount)} 도달 (${formatWon(lost)} 손실)`,
        );
      }
    }
  }
}
