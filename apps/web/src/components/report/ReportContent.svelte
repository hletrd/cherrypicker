<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatRate, formatRatePrecise, formatYearMonthKo, getIssuerFromCardId, formatSavingsValue, buildPageUrl } from '../../lib/formatters.js';
  import {
    describePreviousSpendingBasis,
    GROSS_MONTHLY_REWARD_DISCLOSURE,
    summarizeUnsupportedRules,
  } from '../../lib/analysis-disclosures.js';
  import IssuerBadge from '../ui/IssuerBadge.svelte';

  const homeUrl = buildPageUrl('');

  let opt = $derived(analysisStore.optimization);
  let assignments = $derived(analysisStore.assignments);
  let cardResults = $derived(analysisStore.cardResults);
  let statementPeriod = $derived(analysisStore.statementPeriod);
  let previousSpendingDisclosure = $derived(
    describePreviousSpendingBasis(
      analysisStore.result?.previousSpendingBasis,
    ),
  );
  let unsupportedRulesSummary = $derived(
    summarizeUnsupportedRules(opt?.unsupportedRules),
  );

  let uniqueCardCount = $derived.by(() => {
    const ids = new Set(assignments.map((a) => a.assignedCardId));
    return ids.size;
  });

  let periodLabel = $derived.by(() => {
    if (!statementPeriod) return '-';
    const startStr = formatYearMonthKo(statementPeriod.start);
    const endStr = formatYearMonthKo(statementPeriod.end);
    if (startStr === '-' || endStr === '-') return '-';
    return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
  });
</script>

{#if analysisStore.result && opt}
  <!-- Summary heading -->
  <h2 class="mb-4 text-lg font-bold text-[var(--color-text)]">분석 요약</h2>

  <!-- Summary table -->
  <div class="mb-8 overflow-hidden rounded-xl border border-[var(--color-border)]">
    <table class="w-full text-sm">
      <tbody>
        <tr class="border-b border-[var(--color-border)]">
          <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">분석 기간</th>
          <td class="px-4 py-3 text-[var(--color-text)]">{periodLabel}</td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">총 지출</th>
          <td class="px-4 py-3 font-mono text-[var(--color-text)]">{formatWon(opt.totalSpending)}</td>
        </tr>
        {#if previousSpendingDisclosure}
          <tr class="border-b border-[var(--color-border)]">
            <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">전월실적 기준</th>
            <td class="px-4 py-3 text-[var(--color-text)]">
              {previousSpendingDisclosure.text}
            </td>
          </tr>
        {/if}
        <tr class="border-b border-[var(--color-border)]">
          <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">연회비 차감 전 월간 총혜택</th>
          <td class="px-4 py-3 font-mono text-[var(--color-primary-fg)]">{formatWon(opt.totalReward)}</td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">
            {opt.savingsVsSingleCard >= 0 ? '단일 카드 대비 월간 추가 혜택' : '추천 조합의 월간 혜택 부족분'}
            (연회비 차감 전)
          </th>
          <td class="px-4 py-3 font-mono {opt.savingsVsSingleCard >= 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}">
            {formatSavingsValue(opt.savingsVsSingleCard)}
          </td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">연회비 차감 전 월간 혜택률</th>
          <td class="px-4 py-3 font-mono text-[var(--color-text)]">{formatRatePrecise(opt.effectiveRate)}</td>
        </tr>
        <tr>
          <th scope="row" class="px-4 py-3 font-medium text-left text-[var(--color-text-muted)] bg-[var(--color-bg)]">사용 카드 수</th>
          <td class="px-4 py-3 text-[var(--color-text)]">{uniqueCardCount}장</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p
    class="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text-muted)]"
    data-testid="report-gross-reward-disclosure"
  >
    {GROSS_MONTHLY_REWARD_DISCLOSURE}
  </p>

  {#if unsupportedRulesSummary}
    <section
      class="mb-8 rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      aria-labelledby="report-unsupported-rules-heading"
      data-testid="report-unsupported-rules-summary"
    >
      <h2 id="report-unsupported-rules-heading" class="font-semibold">
        계산에서 제외된 혜택 조건
      </h2>
      <p class="mt-1">
        {unsupportedRulesSummary.transactionCount}개 거래의
        {unsupportedRulesSummary.ruleCount}개 혜택 규칙은 필요한 정보가 없어
        연회비 차감 전 월간 총혜택에 포함하지 않았어요.
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        {#each unsupportedRulesSummary.reasons as reason}
          <li>{reason.label} ({reason.count}건)</li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Assignments heading -->
  <h2 class="mb-4 text-lg font-bold text-[var(--color-text)]">추천 카드 조합</h2>

  <!-- Assignments table -->
  <div class="rounded-xl border border-[var(--color-border)]">
    <div data-testid="report-assignments-mobile" class="space-y-3 p-3 md:hidden print:hidden">
      {#each assignments as a}
        {@const issuer = getIssuerFromCardId(a.assignedCardId)}
        <article class="rounded-lg border border-[var(--color-border)] p-3">
          <h3 class="break-keep [overflow-wrap:anywhere] text-sm font-semibold">{a.categoryNameKo}</h3>
          <div class="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <IssuerBadge {issuer} />
            <span class="min-w-0 break-keep [overflow-wrap:anywhere] text-sm">{a.assignedCardName}</span>
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt class="text-[var(--color-text-muted)]">월간 혜택률 (연회비 차감 전)</dt>
            <dd class="text-right font-mono text-[var(--color-primary-fg)]">{formatRate(a.rate)}</dd>
            <dt class="text-[var(--color-text-muted)]">월간 혜택 (연회비 차감 전)</dt>
            <dd class="text-right font-mono">{formatWon(a.reward)}</dd>
            <dt class="text-[var(--color-text-muted)]">지출</dt>
            <dd class="text-right font-mono">{formatWon(a.spending)}</dd>
          </dl>
        </article>
      {/each}
    </div>
    <table data-testid="report-assignments-table" class="hidden w-full text-sm md:table print:table">
      <thead>
        <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
          <th scope="col" class="px-4 py-2.5 font-medium">카테고리</th>
          <th scope="col" class="px-4 py-2.5 font-medium">추천 카드</th>
          <th scope="col" class="px-4 py-2.5 text-right font-medium">월간 혜택률 (연회비 차감 전)</th>
          <th scope="col" class="px-4 py-2.5 text-right font-medium">월간 혜택 (연회비 차감 전)</th>
          <th scope="col" class="px-4 py-2.5 text-right font-medium">지출</th>
        </tr>
      </thead>
      <tbody>
        {#each assignments as a}
          {@const issuer = getIssuerFromCardId(a.assignedCardId)}
          <tr class="border-b border-[var(--color-border)] last:border-0">
            <td class="px-4 py-2.5 font-medium text-[var(--color-text)]">{a.categoryNameKo}</td>
            <td class="px-4 py-2.5">
              <div class="flex items-center gap-2"><IssuerBadge {issuer} /><span class="font-medium">{a.assignedCardName}</span></div>
            </td>
            <td class="px-4 py-2.5 text-right font-mono text-[var(--color-primary-fg)]">{formatRate(a.rate)}</td>
            <td class="px-4 py-2.5 text-right font-mono text-[var(--color-text)]">{formatWon(a.reward)}</td>
            <td class="px-4 py-2.5 text-right font-mono text-[var(--color-text-muted)]">{formatWon(a.spending)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Per-card breakdown -->
  {#if cardResults.length > 0}
    <h2 class="mt-8 mb-4 text-lg font-bold text-[var(--color-text)]">카드별 상세</h2>

    <div class="rounded-xl border border-[var(--color-border)]">
      <div data-testid="report-card-breakdown-mobile" class="space-y-3 p-3 md:hidden print:hidden">
        {#each cardResults as cr}
          {@const issuer = getIssuerFromCardId(cr.cardId)}
          <article class="rounded-lg border border-[var(--color-border)] p-3">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <IssuerBadge {issuer} />
              <h3 class="min-w-0 break-keep [overflow-wrap:anywhere] text-sm font-semibold">{cr.cardName}</h3>
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt class="text-[var(--color-text-muted)]">해당 지출</dt>
              <dd class="text-right font-mono">{formatWon(cr.totalSpending)}</dd>
              <dt class="text-[var(--color-text-muted)]">월간 혜택 (연회비 차감 전)</dt>
              <dd class="text-right font-mono font-semibold text-[var(--color-primary-fg)]">{formatWon(cr.totalReward)}</dd>
              <dt class="text-[var(--color-text-muted)]">연회비 차감 전 혜택률</dt>
              <dd class="text-right font-mono">{formatRate(cr.effectiveRate)}</dd>
            </dl>
          </article>
        {/each}
      </div>
      <table data-testid="report-card-breakdown-table" class="hidden w-full text-sm md:table print:table">
        <thead>
          <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
            <th scope="col" class="px-4 py-2.5 font-medium">카드명</th>
            <th scope="col" class="px-4 py-2.5 text-right font-medium">해당 지출</th>
            <th scope="col" class="px-4 py-2.5 text-right font-medium">월간 혜택 (연회비 차감 전)</th>
            <th scope="col" class="px-4 py-2.5 text-right font-medium">연회비 차감 전 혜택률</th>
          </tr>
        </thead>
        <tbody>
          {#each cardResults as cr}
            {@const issuer = getIssuerFromCardId(cr.cardId)}
            <tr class="border-b border-[var(--color-border)] last:border-0">
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-2"><IssuerBadge {issuer} /><span class="font-medium">{cr.cardName}</span></div>
              </td>
              <td class="px-4 py-2.5 text-right font-mono text-xs text-[var(--color-text-muted)]">{formatWon(cr.totalSpending)}</td>
              <td class="px-4 py-2.5 text-right font-mono text-xs font-semibold text-[var(--color-primary-fg)]">{formatWon(cr.totalReward)}</td>
              <td class="px-4 py-2.5 text-right font-mono text-xs text-[var(--color-text-muted)]">{formatRate(cr.effectiveRate)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{:else}
  <div class="flex flex-col items-center gap-4 py-8">
    <p class="text-[var(--color-text-muted)]">아직 분석 결과가 없어요</p>
    <a href={homeUrl}
      class="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-fill)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-fill-hover)] transition-colors"
    >명세서 올리러 가기</a>
  </div>
{/if}
