import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { OptimizationResult, CategorizedTransaction } from '@cherrypicker/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return `${amount.toLocaleString('ko-KR')}원`;
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '0.00%';
  return `${(rate * 100).toFixed(2)}%`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSummary(result: OptimizationResult): string {
  const savingsSign = result.savingsVsSingleCard >= 0 ? '+' : '';
  return `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">총 지출액</div>
        <div class="value">${formatWon(result.totalSpending)}</div>
      </div>
      <div class="metric-card">
        <div class="label">총 예상 혜택</div>
        <div class="value">${formatWon(result.totalReward)}</div>
      </div>
      <div class="metric-card">
        <div class="label">유효 혜택률</div>
        <div class="value">${formatRate(result.effectiveRate)}</div>
      </div>
      <div class="metric-card">
        <div class="label">단일 최적 카드 대비 추가 혜택</div>
        <div class="value">${savingsSign}${formatWon(result.savingsVsSingleCard)}</div>
        <div class="sub">단일 최적: ${esc(result.bestSingleCard.cardName)}</div>
      </div>
    </div>
  `;
}

function buildCategoryTable(transactions: CategorizedTransaction[]): string {
  const byCategory = new Map<string, { labelKo: string; total: number; count: number }>();
  let grandTotal = 0;

  for (const tx of transactions) {
    const existing = byCategory.get(tx.category);
    if (existing) {
      existing.total += tx.amount;
      existing.count += 1;
    } else {
      byCategory.set(tx.category, {
        labelKo: tx.category,
        total: tx.amount,
        count: 1,
      });
    }
    grandTotal += tx.amount;
  }

  const rows = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);

  const rowsHtml = rows
    .map(([, v]) => {
      const pct = grandTotal > 0 ? ((v.total / grandTotal) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td>${esc(v.labelKo)}</td>
          <td class="right">${formatWon(v.total)}</td>
          <td class="right">${v.count}건</td>
          <td class="right">${pct}%</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>카테고리</th>
          <th class="right">지출액</th>
          <th class="right">건수</th>
          <th class="right">비중</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="highlight-row">
          <td>합계</td>
          <td class="right">${formatWon(grandTotal)}</td>
          <td class="right">${transactions.length}건</td>
          <td class="right">100.0%</td>
        </tr>
      </tbody>
    </table>
  `;
}

function buildCardComparison(result: OptimizationResult): string {
  const sorted = [...result.cardResults].sort((a, b) => b.totalReward - a.totalReward);
  const best = sorted[0]?.cardId;

  const rowsHtml = sorted
    .map((r) => {
      const isBest = r.cardId === best;
      const capsWarning = r.capsHit.length > 0
        ? `<span class="badge badge-warning" title="한도 도달 항목 있음">한도 ${r.capsHit.length}건</span>`
        : '';
      return `
        <tr${isBest ? ' class="highlight-row"' : ''}>
          <td>${esc(r.cardName)}${isBest ? ' <span class="badge badge-success">최적</span>' : ''}</td>
          <td class="right">${formatWon(r.totalReward)}</td>
          <td class="right">${formatRate(r.effectiveRate)}</td>
          <td>${esc(r.performanceTier)}</td>
          <td class="center">${capsWarning}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>카드명</th>
          <th class="right">총 혜택액</th>
          <th class="right">유효 혜택률</th>
          <th>전월실적 구간</th>
          <th class="center">한도</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function buildAssignments(result: OptimizationResult): string {
  const rowsHtml = result.assignments
    .map((a) => {
      const alts = a.alternatives.length > 0
        ? a.alternatives
            .slice(0, 2)
            .map((alt) => `${esc(alt.cardName)} (${formatRate(alt.rate)})`)
            .join(', ')
        : '—';
      return `
        <tr>
          <td>${esc(a.categoryNameKo)}</td>
          <td><strong>${esc(a.assignedCardName)}</strong></td>
          <td class="right">${formatRate(a.rate)}</td>
          <td class="right">${formatWon(a.reward)}</td>
          <td class="right">${formatWon(a.spending)}</td>
          <td>${alts}</td>
        </tr>
      `;
    })
    .join('');

  // Caps hit warnings block
  const allCaps = result.cardResults.flatMap((r) =>
    r.capsHit.map((c) => ({ cardName: r.cardName, ...c })),
  );

  const capsBlock =
    allCaps.length > 0
      ? `<div class="warn-box">
          <strong>⚠ 한도 도달 경고</strong>
          ${allCaps
            .map(
              (cap) =>
                `<p>[${esc(cap.cardName)}] ${esc(cap.category)}: 월 한도 ${formatWon(cap.capAmount)} 도달 — ${formatWon(cap.actualReward - cap.appliedReward)} 혜택 손실</p>`,
            )
            .join('')}
        </div>`
      : '';

  return `
    <table>
      <thead>
        <tr>
          <th>카테고리</th>
          <th>추천 카드</th>
          <th class="right">혜택률</th>
          <th class="right">예상 혜택</th>
          <th class="right">지출액</th>
          <th>대안 카드</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${capsBlock}
  `;
}

export function generateHTMLReport(
  result: OptimizationResult,
  transactions: CategorizedTransaction[],
): string {
  const templatePath = join(__dirname, 'templates', 'report.html');
  const template = readFileSync(templatePath, 'utf-8');

  const html = template
    .replace('{{GENERATED_DATE}}', esc(formatDate(new Date())))
    .replace('{{SUMMARY}}', buildSummary(result))
    .replace('{{CATEGORY_TABLE}}', buildCategoryTable(transactions))
    .replace('{{CARD_COMPARISON}}', buildCardComparison(result))
    .replace('{{ASSIGNMENTS}}', buildAssignments(result));

  return html;
}
