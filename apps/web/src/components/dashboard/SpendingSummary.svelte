<script lang="ts">
  import { onMount } from 'svelte';
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatRatePrecise, formatYearMonthKo, buildPageUrl } from '../../lib/formatters.js';
  import {
    describePreviousSpendingBasis,
    summarizeUnsupportedRules,
  } from '../../lib/analysis-disclosures.js';
  import { sumMonthlySpending } from '../../lib/analysis-context.js';
  import Icon from '../ui/Icon.svelte';

  const homeUrl = buildPageUrl('');

  let dismissed = $state(false);

  // Reset dismissal when a new analysis result is produced, so the user
  // is re-warned about the new data being at risk of loss (C78-01).
  // Without this, once dismissed, the warning stays hidden across all
  // subsequent analyses until the tab is closed.
  // Plain let instead of $state -- only read/written within the same
  // $effect, no other binding depends on it (C83-04).
  let lastWarningGeneration = 0;
  $effect(() => {
    const gen = analysisStore.generation;
    if (gen > 0 && gen !== lastWarningGeneration) {
      dismissed = false;
      lastWarningGeneration = gen;
    }
  });

  // Total spending across all months (computed once via $derived instead of
  // inline reduce in the template for better change detection and consistency
  // with other dashboard components).
  let totalAllSpending = $derived.by(() => {
    const mb = analysisStore.result?.monthlyBreakdown;
    return mb ? sumMonthlySpending(mb) : 0;
  });
  let previousSpendingDisclosure = $derived(
    describePreviousSpendingBasis(
      analysisStore.result?.previousSpendingBasis,
    ),
  );
  let unsupportedRulesSummary = $derived(
    summarizeUnsupportedRules(
      analysisStore.optimization?.unsupportedRules,
    ),
  );

  onMount(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cherrypicker:dismissed-warning')) {
        dismissed = true;
      }
    } catch {
      if (typeof console !== 'undefined') console.debug('[cherrypicker] sessionStorage access failed in SpendingSummary (expected in restricted environments)');
      // SecurityError in restricted environments (strict private browsing,
      // cross-origin iframes). Dismissal state won't persist, but the
      // component still renders without crashing.
    }
  });

  function formatPeriod(period: { start: string; end: string } | undefined): string {
    if (!period) return '-';
    const startStr = formatYearMonthKo(period.start);
    const endStr = formatYearMonthKo(period.end);
    if (startStr === '-' || endStr === '-') return '-';
    return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
  }

  function getTopCategory(assignments: typeof analysisStore.assignments): string {
    if (!assignments.length) return '-';
    const top = [...assignments].sort((a, b) => b.spending - a.spending)[0];
    return top?.categoryNameKo ?? '-';
  }
</script>

{#if analysisStore.loading}
  <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
    {#each Array(5) as _}
      <div class="animate-pulse rounded-xl bg-[var(--color-bg)] p-4">
        <div class="mb-2 h-4 w-16 rounded bg-[var(--color-border)]"></div>
        <div class="h-7 w-24 rounded bg-[var(--color-border)]"></div>
      </div>
    {/each}
  </div>
{:else if analysisStore.result}
  <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
    <!-- 최근 월 지출 (optimization covers latest month only) -->
    <div
      class="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm dark:from-blue-950 dark:to-blue-900/50"
      data-testid="latest-spending-tile"
    >
      <div class="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300">
        <Icon name="credit-card" size={15} />
        <span>최근 월 지출</span>
      </div>
      <div
        class="mt-1 text-2xl font-bold text-[var(--color-primary-fg)]"
        data-testid="latest-spending-value"
      >
        {formatWon(analysisStore.optimization?.totalSpending ?? 0)}
      </div>
      {#if analysisStore.result?.monthlyBreakdown && analysisStore.result.monthlyBreakdown.length > 1}
        <div class="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
          전체 {formatWon(totalAllSpending)}
        </div>
      {/if}
    </div>

    <!-- 거래 건수 (latest month primary, total secondary) -->
    <div class="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm dark:from-amber-950 dark:to-amber-900/50">
      <div class="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
        <Icon name="receipt" size={15} />
        <span>거래 건수</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
        {analysisStore.transactionCount}건
      </div>
      {#if analysisStore.result?.monthlyBreakdown && analysisStore.result.monthlyBreakdown.length > 1}
        <div class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
          전체 {analysisStore.totalTransactionCount}건
        </div>
      {/if}
    </div>

    <!-- 분석 기간 -->
    <div class="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 shadow-sm">
      <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
        <Icon name="calendar" size={15} />
        <span>분석 기간</span>
      </div>
      <div class="mt-1 text-lg font-semibold text-[var(--color-text)]">
        {formatPeriod(analysisStore.fullStatementPeriod)}
      </div>
    </div>

    <!-- 최다 지출 카테고리 -->
    <div class="rounded-xl bg-gradient-to-br from-green-50 to-green-100 p-4 shadow-sm dark:from-green-950 dark:to-green-900/50">
      <div class="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
        <Icon name="tag" size={15} />
        <span>최다 지출 카테고리</span>
      </div>
      <div class="mt-1 text-lg font-semibold text-green-700 dark:text-green-400">
        {getTopCategory(analysisStore.assignments)}
      </div>
    </div>

    <!-- 연회비 차감 전 월간 총혜택률 -->
    <div class="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 shadow-sm dark:from-purple-950 dark:to-purple-900/50">
      <div class="flex items-center gap-1.5 text-sm text-purple-700 dark:text-purple-300">
        <Icon name="percent" size={15} />
        <span>월간 총혜택률 (연회비 차감 전)</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-400">
        {analysisStore.optimization ? formatRatePrecise(analysisStore.optimization.effectiveRate) : '-'}
      </div>
    </div>
  </div>
  {#if analysisStore.optimization && analysisStore.optimization.unassignedTransactionCount > 0}
    <div
      class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      role="status"
      data-testid="unassigned-spending-summary"
    >
      <span class="font-semibold">혜택 미배정 지출:</span>
      계산 가능한 양의 혜택이 없어
      {analysisStore.optimization.unassignedTransactionCount}건,
      {formatWon(analysisStore.optimization.unassignedSpending)}을 카드에 배정하지 않았어요.
    </div>
  {/if}
  {#if previousSpendingDisclosure}
    <div
      class="mt-3 rounded-lg border px-3 py-2 text-xs
        {previousSpendingDisclosure.tone === 'warning'
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
          : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]'}"
      role={previousSpendingDisclosure.tone === 'warning' ? 'status' : undefined}
      data-testid="previous-spending-basis"
    >
      <span class="font-semibold">전월실적 기준:</span>
      {previousSpendingDisclosure.text}
    </div>
  {/if}
  {#if unsupportedRulesSummary}
    <section
      class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      aria-labelledby="unsupported-rules-heading"
      data-testid="unsupported-rules-summary"
    >
      <h3 id="unsupported-rules-heading" class="font-semibold">
        일부 혜택은 계산에서 제외됐어요
      </h3>
      <p class="mt-1">
        {unsupportedRulesSummary.transactionCount}개 거래의
        {unsupportedRulesSummary.ruleCount}개 혜택 규칙은 필요한 정보가 없어
        예상 혜택에 포함하지 않았어요.
      </p>
      <ul class="mt-1 list-disc pl-5">
        {#each unsupportedRulesSummary.reasons as reason}
          <li>{reason.label} ({reason.count}건)</li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if analysisStore.result && !dismissed}
    <div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
      <span>탭을 닫으면 결과가 사라져요. 저장하려면 리포트를 PDF로 내려받으세요.</span>
      <button class="ml-auto inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded text-amber-700 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] dark:text-amber-300 dark:hover:text-amber-100" onclick={() => { dismissed = true; try { sessionStorage.setItem('cherrypicker:dismissed-warning', '1'); } catch (err) { /* Dismissal won't persist -- non-critical, but log when sessionStorage is available and the failure isn't an expected SSR/sandbox/private-browsing scenario (C24-02/C27-01/C30-03/C31-01/C61-03). */ if (typeof sessionStorage !== 'undefined' && !(err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'))) { console.warn('[cherrypicker] Failed to persist dismiss state:', err); } } }}>닫기</button>
    </div>
  {/if}
  {#if analysisStore.persistWarningKind === 'truncated'}
    <div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
      <span>데이터가 커서 거래 내역{analysisStore.truncatedTxCount ? ` ${analysisStore.truncatedTxCount}건` : ''}이(가) 저장되지 않았어요. 탭을 닫으면 분석 결과도 사라져요.</span>
    </div>
  {:else if analysisStore.persistWarningKind === 'quota_exceeded'}
    <div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
      <span>저장 공간이 부족해서 데이터를 저장하지 못했어요. 탭을 닫으면 결과가 사라져요.</span>
    </div>
  {:else if analysisStore.persistWarningKind === 'corrupted'}
    <div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
      <span>거래 내역을 불러오지 못했어요. 다시 분석해 보세요.</span>
    </div>
  {:else if analysisStore.persistWarningKind === 'error'}
    <div class="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
      <span>데이터 저장에 예기치 않은 오류가 발생했어요. 페이지를 새로고침하고 다시 시도해 보세요.</span>
    </div>
  {/if}
{:else}
  <div class="mt-4 flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] text-center">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="folder-open" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">아직 분석한 내역이 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 올려 보세요</div>
    <a
      href={homeUrl}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-fill)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-fill-hover)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
