import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type {
  CalculationIssue,
  CategorizedTransaction,
  OptimizationResult,
  PreviousSpendingBasis,
} from '@cherrypicker/core';
import { aggregatePositiveSpending } from '../spending-aggregation.js';
import {
  GROSS_MONTHLY_REWARD_DISCLOSURE_KO,
  GROSS_MONTHLY_REWARD_LABEL_KO,
} from '../reward-disclosure.js';
import {
  formatCapOutcomeKo,
  formatCapPeriodKo,
} from '../cap-disclosure.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STYLE_HASH_PLACEHOLDER = '{{STYLE_SHA256}}';
const REPORT_PLACEHOLDER_PATTERN = /{{([^{}]+)}}/g;
const REPORT_PLACEHOLDER_NAMES = [
  'STYLE_SHA256',
  'GENERATED_DATE',
  'ANALYSIS_LIMITATIONS',
  'SUMMARY',
  'CATEGORY_TABLE',
  'CARD_COMPARISON',
  'ASSIGNMENTS',
] as const;

type ReportPlaceholderName = (typeof REPORT_PLACEHOLDER_NAMES)[number];

export type ReportTemplateReplacements = {
  [Name in ReportPlaceholderName]: string;
};

export interface StandaloneReportParseExclusion {
  message: string;
  code?: string;
  line?: number;
  file?: string;
  format?: string;
}

export interface StandaloneReportCalendarExclusion {
  kind: 'invalid-date' | 'outside-latest-month';
  count: number;
  message: string;
}

export interface StandaloneReportContext {
  latestStatementPeriod?: { start: string; end: string };
  fullStatementPeriod?: { start: string; end: string };
  latestTransactionCount: number;
  fullTransactionCount: number;
  parserExclusions: readonly StandaloneReportParseExclusion[];
  calendarExclusions: readonly StandaloneReportCalendarExclusion[];
  previousSpendingBasis: PreviousSpendingBasis;
  unsupportedIssues: readonly CalculationIssue[];
}

export function renderReportTemplate(
  template: string,
  replacements: Readonly<ReportTemplateReplacements>,
): string {
  const expected = new Set<string>(REPORT_PLACEHOLDER_NAMES);
  const replacementNames = Object.keys(replacements);
  const unknownReplacement = replacementNames.find((name) => !expected.has(name));
  if (unknownReplacement) {
    throw new Error(`Unknown report replacement: ${unknownReplacement}`);
  }
  const missingReplacement = REPORT_PLACEHOLDER_NAMES.find(
    (name) => !Object.hasOwn(replacements, name),
  );
  if (missingReplacement) {
    throw new Error(`Missing report replacement: ${missingReplacement}`);
  }

  const counts = new Map<string, number>();
  for (const match of template.matchAll(REPORT_PLACEHOLDER_PATTERN)) {
    const name = match[1]!;
    if (!expected.has(name)) {
      throw new Error(`Unknown report template placeholder: ${name}`);
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const name of REPORT_PLACEHOLDER_NAMES) {
    const count = counts.get(name) ?? 0;
    if (count !== 1) {
      throw new Error(
        `Report template placeholder ${name} must occur exactly once; found ${count}`,
      );
    }
  }

  // Replace against the original template in one pass. Replacement text is
  // never scanned as template syntax.
  return template.replace(REPORT_PLACEHOLDER_PATTERN, (_token, name: string) => {
    return replacements[name as ReportPlaceholderName];
  });
}

function hashInlineStylesheet(template: string): string {
  const styles = [...template.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  if (styles.length !== 1 || styles[0]?.[1] === undefined) {
    throw new Error(
      `Report template must contain exactly one inline stylesheet; found ${styles.length}`,
    );
  }
  if (template.split(STYLE_HASH_PLACEHOLDER).length !== 2) {
    throw new Error('Report template must contain exactly one stylesheet hash placeholder');
  }
  return createHash('sha256').update(styles[0][1], 'utf8').digest('base64');
}

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
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/\x7f/g, '')
    .replace(/￾|￿/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPeriod(
  period: { start: string; end: string } | undefined,
): string {
  return period
    ? `${esc(period.start)} ~ ${esc(period.end)}`
    : '확인할 수 없음';
}

function formatPreviousSpendingBasis(
  basis: PreviousSpendingBasis,
): string {
  switch (basis.kind) {
    case 'user-total':
      return `사용자 입력 전월실적 ${formatWon(basis.amount)}`;
    case 'statement-month':
      return `명세서의 직전 달(${esc(basis.month)}) 거래 합계`;
    case 'missing-calendar-month':
      return `직전 달(${esc(basis.month)}) 거래가 없어 ${formatWon(basis.assumedAmount)}으로 가정`;
  }
}

function buildAnalysisLimitations(context: StandaloneReportContext): string {
  const parserItems = context.parserExclusions.length === 0
    ? '<li>파서가 제외하거나 경고한 항목 없음</li>'
    : context.parserExclusions
        .map((exclusion) => {
          const location = [
            exclusion.file ? `파일 ${esc(exclusion.file)}` : '',
            exclusion.format ? `형식 ${esc(exclusion.format)}` : '',
            exclusion.line !== undefined ? `${exclusion.line}행` : '',
            exclusion.code ? `코드 ${esc(exclusion.code)}` : '',
          ].filter(Boolean);
          const prefix = location.length > 0 ? `${location.join(' · ')}: ` : '';
          return `<li>${prefix}${esc(exclusion.message)}</li>`;
        })
        .join('');

  const calendarItems = context.calendarExclusions.length === 0
    ? '<li>날짜 또는 분석 월 범위로 제외한 거래 없음</li>'
    : context.calendarExclusions
        .map(
          (exclusion) =>
            `<li>${esc(exclusion.message)} (${formatCount(exclusion.count)}건)</li>`,
        )
        .join('');

  const unsupportedItems = context.unsupportedIssues.length === 0
    ? '<li>지원하지 못한 혜택 계산 없음</li>'
    : context.unsupportedIssues
        .map((issue) => {
          const detail = issue.detail ? ` — ${esc(issue.detail)}` : '';
          return (
            `<li>카드 ${esc(issue.cardId)} · 거래 ${esc(issue.transactionId)} · ` +
            `규칙 ${esc(issue.ruleId)} · 카테고리 ${esc(issue.category)}: ` +
            `${esc(issue.reason)}${detail}</li>`
          );
        })
        .join('');

  return `
    <div class="scope-grid">
      <div>
        <strong>추천 계산 범위</strong>
        <p>최신 명세서 월: ${formatPeriod(context.latestStatementPeriod)}
          (${formatCount(context.latestTransactionCount)}건)</p>
      </div>
      <div>
        <strong>불러온 전체 범위</strong>
        <p>${formatPeriod(context.fullStatementPeriod)}
          (${formatCount(context.fullTransactionCount)}건)</p>
      </div>
      <div>
        <strong>전월실적 판단 기준</strong>
        <p>${formatPreviousSpendingBasis(context.previousSpendingBasis)}</p>
      </div>
    </div>
    <div class="limitation-list">
      <strong>파싱 제외 및 경고</strong>
      <ul>${parserItems}</ul>
    </div>
    <div class="limitation-list">
      <strong>달력 범위 제외</strong>
      <ul>${calendarItems}</ul>
    </div>
    <div class="limitation-list">
      <strong>정확히 계산하지 못한 혜택 (${formatCount(context.unsupportedIssues.length)}건)</strong>
      <ul>${unsupportedItems}</ul>
    </div>
    <div class="limitation-list">
      <strong>혜택 금액 기준</strong>
      <p>${GROSS_MONTHLY_REWARD_DISCLOSURE_KO}</p>
    </div>
  `;
}

function formatCount(count: number): string {
  return Number.isSafeInteger(count) && count >= 0
    ? count.toLocaleString('ko-KR')
    : '0';
}

function buildSummary(result: OptimizationResult): string {
  const savingsSign = result.savingsVsSingleCard >= 0 ? '+' : '';
  const differenceLabel = result.bestSingleCard === null
    ? '단일 카드 비교'
    : result.savingsVsSingleCard >= 0
      ? '단일 최적 카드 대비 월간 추가 혜택'
      : '추천 조합의 월간 혜택 부족분';
  const differenceValue = result.bestSingleCard === null
    ? '비교할 양의 혜택 없음'
    : `${savingsSign}${formatWon(Math.abs(result.savingsVsSingleCard))}`;
  const singleCardDetail = result.bestSingleCard === null
    ? '계산 가능한 양의 혜택 없음'
    : `단일 최적: ${esc(result.bestSingleCard.cardName)}`;
  const unassignedMetric = result.unassignedTransactionCount > 0
    ? `
      <div class="metric-card">
        <div class="label">혜택 미배정 지출</div>
        <div class="value">${formatWon(result.unassignedSpending)}</div>
        <div class="sub">${formatCount(result.unassignedTransactionCount)}건 · 계산 가능한 양의 혜택 없음</div>
      </div>
    `
    : '';
  return `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">총 지출액</div>
        <div class="value">${formatWon(result.totalSpending)}</div>
      </div>
      <div class="metric-card">
        <div class="label">${GROSS_MONTHLY_REWARD_LABEL_KO}</div>
        <div class="value">${formatWon(result.totalReward)}</div>
      </div>
      <div class="metric-card">
        <div class="label">연회비 차감 전 월간 혜택률</div>
        <div class="value">${formatRate(result.effectiveRate)}</div>
      </div>
      <div class="metric-card">
        <div class="label">${differenceLabel} (연회비 차감 전)</div>
        <div class="value">${differenceValue}</div>
        <div class="sub">${singleCardDetail}</div>
      </div>
      ${unassignedMetric}
    </div>
  `;
}

function buildCategoryTable(transactions: CategorizedTransaction[], categoryLabels: Map<string, string>): string {
  const {
    categories,
    grandTotal,
    includedCount,
  } = aggregatePositiveSpending(transactions, categoryLabels);
  const rows = categories.sort((a, b) => b.total - a.total);

  const rowsHtml = rows
    .map((row) => {
      const pct = grandTotal > 0
        ? ((row.total / grandTotal) * 100).toFixed(1)
        : '0.0';
      return `
        <tr>
          <td>${esc(row.labelKo)}</td>
          <td class="right">${formatWon(row.total)}</td>
          <td class="right">${row.count}건</td>
          <td class="right">${pct}%</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table>
      <caption>카테고리별 지출 현황</caption>
      <thead>
        <tr>
          <th scope="col">카테고리</th>
          <th scope="col" class="right">지출액</th>
          <th scope="col" class="right">건수</th>
          <th scope="col" class="right">비중</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="highlight-row">
          <td>합계</td>
          <td class="right">${formatWon(grandTotal)}</td>
          <td class="right">${includedCount}건</td>
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
      <caption>카드별 월간 총혜택 비교 (연회비 차감 전)</caption>
      <thead>
        <tr>
          <th scope="col">카드명</th>
          <th scope="col" class="right">월간 총혜택 (연회비 차감 전)</th>
          <th scope="col" class="right">연회비 차감 전 혜택률</th>
          <th scope="col">전월실적 구간</th>
          <th scope="col" class="center">한도</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function buildAssignments(result: OptimizationResult): string {
  const assignmentRows = result.assignments
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
  const rowsHtml = assignmentRows || `
    <tr>
      <td colspan="6">계산 가능한 양의 혜택이 없어 추천 카드 배정이 없습니다.</td>
    </tr>
  `;

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
                `<p>[${esc(cap.cardName)}] ${esc(cap.category)}: ${formatCapPeriodKo(cap)} ${formatWon(cap.capAmount)} 도달 — ${formatCapOutcomeKo(cap, formatWon)}</p>`,
            )
            .join('')}
        </div>`
      : '';
  const unassignedBlock = result.unassignedTransactionCount > 0
    ? `<div class="warn-box">
        <strong>혜택 미배정 지출</strong>
        <p>${formatCount(result.unassignedTransactionCount)}건, ${formatWon(result.unassignedSpending)}은 계산 가능한 양의 혜택이 없어 카드에 배정하지 않았습니다.</p>
      </div>`
    : '';

  return `
    <table>
      <caption>카테고리별 추천 카드 배분 (연회비 차감 전 월간 총혜택)</caption>
      <thead>
        <tr>
          <th scope="col">카테고리</th>
          <th scope="col">추천 카드</th>
          <th scope="col" class="right">월간 혜택률 (연회비 차감 전)</th>
          <th scope="col" class="right">월간 혜택 (연회비 차감 전)</th>
          <th scope="col" class="right">지출액</th>
          <th scope="col">대안 카드</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${unassignedBlock}
    ${capsBlock}
  `;
}

export function generateHTMLReport(
  result: OptimizationResult,
  transactions: CategorizedTransaction[],
  categoryLabels: Map<string, string>,
  context: StandaloneReportContext,
): string {
  const templatePath = join(__dirname, 'templates', 'report.html');
  const template = readFileSync(templatePath, 'utf-8');

  return renderReportTemplate(template, {
    STYLE_SHA256: hashInlineStylesheet(template),
    GENERATED_DATE: esc(formatDate(new Date())),
    ANALYSIS_LIMITATIONS: buildAnalysisLimitations(context),
    SUMMARY: buildSummary(result),
    CATEGORY_TABLE: buildCategoryTable(transactions, categoryLabels),
    CARD_COMPARISON: buildCardComparison(result),
    ASSIGNMENTS: buildAssignments(result),
  });
}
