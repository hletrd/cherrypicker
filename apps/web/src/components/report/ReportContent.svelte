<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatRate, formatRatePrecise, formatYearMonthKo, getIssuerColor, getIssuerTextColor, getIssuerFromCardId, formatIssuerNameKo, formatSavingsValue } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  let opt = $derived(analysisStore.optimization);
  let assignments = $derived(analysisStore.assignments);
  let cardResults = $derived(analysisStore.cardResults);
  let statementPeriod = $derived(analysisStore.statementPeriod);

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
          <td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">분석 기간</td>
          <td class="px-4 py-3 text-[var(--color-text)]">{periodLabel}</td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">총 지출</td>
          <td class="px-4 py-3 font-mono text-[var(--color-text)]">{formatWon(opt.totalSpending)}</td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">체리피킹 혜택</td>
          <td class="px-4 py-3 font-mono text-[var(--color-primary)]">{formatWon(opt.totalReward)}</td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">{opt.savingsVsSingleCard >= 0 ? '추가 절약' : '추가 비용'}</td>
          <td class="px-4 py-3 font-mono {opt.savingsVsSingleCard >= 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}">
            {formatSavingsValue(opt.savingsVsSingleCard)}
          </td>
        </tr>
        <tr class="border-b border-[var(--color-border)]">
          <td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">실효 혜택률</td>
          <td class="px-4 py-3 font-mono text-[var(--color-text)]">{formatRatePrecise(opt.effectiveRate)}</td>
        </tr>
        <tr>
          <td class="px-4 py-3 font-medium text-[var(--color-text-muted)] bg-[var(--color-bg)]">사용 카드 수</td>
          <td class="px-4 py-3 text-[var(--color-text)]">{uniqueCardCount}장</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Assignments heading -->
  <h2 class="mb-4 text-lg font-bold text-[var(--color-text)]">추천 카드 조합</h2>

  <!-- Assignments table -->
  <div class="overflow-hidden rounded-xl border border-[var(--color-border)]">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
          <th scope="col" class="px-4 py-2.5 font-medium">카테고리</th>
          <th scope="col" class="px-4 py-2.5 font-medium">추천 카드</th>
          <th scope="col" class="px-4 py-2.5 text-right font-medium">혜택률</th>
          <th scope="col" class="px-4 py-2.5 text-right font-medium">혜택</th>
          <th scope="col" class="px-4 py-2.5 text-right font-medium">지출</th>
        </tr>
      </thead>
      <tbody>
        {#each assignments as a}
          {@const issuer = getIssuerFromCardId(a.assignedCardId)}
          <tr class="border-b border-[var(--color-border)] last:border-0">
            <td class="px-4 py-2.5 font-medium text-[var(--color-text)]">{a.categoryNameKo}</td>
            <td class="px-4 py-2.5">
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs {getIssuerTextColor(issuer)}"
                style="background-color: {getIssuerColor(issuer)}"
              >
                {a.assignedCardName}
              </span>
            </td>
            <td class="px-4 py-2.5 text-right font-mono text-[var(--color-primary)]">{formatRate(a.rate)}</td>
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

    <div class="overflow-hidden rounded-xl border border-[var(--color-border)]">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
            <th scope="col" class="px-4 py-2.5 font-medium">카드명</th>
            <th scope="col" class="px-4 py-2.5 text-right font-medium">해당 지출</th>
            <th scope="col" class="px-4 py-2.5 text-right font-medium">예상 혜택</th>
            <th scope="col" class="px-4 py-2.5 text-right font-medium">혜택률</th>
          </tr>
        </thead>
        <tbody>
          {#each cardResults as cr}
            {@const issuer = getIssuerFromCardId(cr.cardId)}
            <tr class="border-b border-[var(--color-border)] last:border-0">
              <td class="px-4 py-2.5">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs {getIssuerTextColor(issuer)}"
                  style="background-color: {getIssuerColor(issuer)}"
                >
                  {cr.cardName}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right font-mono text-xs text-[var(--color-text-muted)]">{formatWon(cr.totalSpending)}</td>
              <td class="px-4 py-2.5 text-right font-mono text-xs font-semibold text-[var(--color-primary)]">{formatWon(cr.totalReward)}</td>
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
    <a href={import.meta.env.BASE_URL ?? '/'}
      class="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors"
    >명세서 올리러 가기</a>
  </div>
{/if}
