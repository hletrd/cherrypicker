import Table from 'cli-table3';
import type { CategorizedTransaction } from '@cherrypicker/core';
import type { CardRewardResult } from '@cherrypicker/core';

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

interface CategorySummary {
  categoryId: string;
  labelKo: string;
  total: number;
  count: number;
}

export function printSpendingSummary(transactions: CategorizedTransaction[]): void {
  // Aggregate by category
  const byCategory = new Map<string, CategorySummary>();
  let grandTotal = 0;

  for (const tx of transactions) {
    const existing = byCategory.get(tx.category);
    if (existing) {
      existing.total += tx.amount;
      existing.count += 1;
    } else {
      byCategory.set(tx.category, {
        categoryId: tx.category,
        labelKo: tx.category,
        total: tx.amount,
        count: 1,
      });
    }
    grandTotal += tx.amount;
  }

  const rows = [...byCategory.values()].sort((a, b) => b.total - a.total);

  const table = new Table({
    head: ['카테고리', '지출액', '건수', '비중(%)'],
    colAligns: ['left', 'right', 'right', 'right'],
    style: { head: ['cyan'] },
  });

  for (const row of rows) {
    const pct = grandTotal > 0 ? ((row.total / grandTotal) * 100).toFixed(1) : '0.0';
    table.push([row.labelKo, formatWon(row.total), String(row.count), `${pct}%`]);
  }

  // Total row
  table.push(['합계', formatWon(grandTotal), String(transactions.length), '100.0%']);

  console.log('\n지출 내역 요약');
  console.log('='.repeat(60));
  console.log(table.toString());
}

export function printCardComparison(results: CardRewardResult[]): void {
  const sorted = [...results].sort((a, b) => b.totalReward - a.totalReward);

  const table = new Table({
    head: ['카드명', '총 혜택액', '유효 혜택률', '전월실적 구간'],
    colAligns: ['left', 'right', 'right', 'left'],
    style: { head: ['cyan'] },
  });

  for (const r of sorted) {
    table.push([
      r.cardName,
      formatWon(r.totalReward),
      formatRate(r.effectiveRate),
      r.performanceTier,
    ]);
  }

  console.log('\n카드별 혜택 비교');
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
          `  [${r.cardName}] ${cap.category}: 한도 ${formatWon(cap.capAmount)} 도달 (${formatWon(lost)} 손실)`,
        );
      }
    }
  }
}
