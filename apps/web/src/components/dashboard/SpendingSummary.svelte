<script lang="ts">
  import { onMount } from 'svelte';
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  let dismissed = $state(false);

  onMount(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('cherrypicker:dismissed-warning')) {
      dismissed = true;
    }
  });

  function formatPeriod(period: { start: string; end: string } | undefined): string {
    if (!period) return '-';
    const [sy, sm] = period.start.split('-');
    const [ey, em] = period.end.split('-');
    if (!sy || !sm || !ey || !em) return '-';
    const startStr = `${sy}년 ${parseInt(sm, 10)}월`;
    const endStr = `${ey}년 ${parseInt(em, 10)}월`;
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
        <div class="mb-2 h-4 w-16 rounded bg-gray-200"></div>
        <div class="h-7 w-24 rounded bg-gray-300"></div>
      </div>
    {/each}
  </div>
{:else if analysisStore.result}
  <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
    <!-- 총 지출 -->
    <div class="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm dark:from-blue-950 dark:to-blue-900/50">
      <div class="flex items-center gap-1.5 text-sm text-blue-500 dark:text-blue-400">
        <Icon name="credit-card" size={15} />
        <span>총 지출</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-[var(--color-primary)]">
        {formatWon(analysisStore.optimization?.totalSpending ?? 0)}
      </div>
    </div>

    <!-- 거래 건수 -->
    <div class="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm dark:from-amber-950 dark:to-amber-900/50">
      <div class="flex items-center gap-1.5 text-sm text-amber-500 dark:text-amber-400">
        <Icon name="receipt" size={15} />
        <span>거래 건수</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
        {analysisStore.totalTransactionCount}건
      </div>
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
      <div class="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
        <Icon name="tag" size={15} />
        <span>최다 지출 카테고리</span>
      </div>
      <div class="mt-1 text-lg font-semibold text-green-700 dark:text-green-400">
        {getTopCategory(analysisStore.assignments)}
      </div>
    </div>

    <!-- 실효 혜택률 -->
    <div class="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 shadow-sm dark:from-purple-950 dark:to-purple-900/50">
      <div class="flex items-center gap-1.5 text-sm text-purple-500 dark:text-purple-400">
        <Icon name="percent" size={15} />
        <span>실효 혜택률</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-400">
        {analysisStore.optimization ? (analysisStore.optimization.effectiveRate * 100).toFixed(2) + '%' : '-'}
      </div>
    </div>
  </div>
  {#if analysisStore.result?.monthlyBreakdown && analysisStore.result.monthlyBreakdown.length > 1}
    <div class="col-span-full mt-2 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
      {analysisStore.result.monthlyBreakdown.length}개월 데이터 분석 ·
      전월실적 {formatWon(analysisStore.result.monthlyBreakdown[analysisStore.result.monthlyBreakdown.length - 2]?.spending ?? 0)} 기준
    </div>
  {/if}
  {#if analysisStore.result && !dismissed}
    <div class="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
      <span>탭을 닫으면 결과가 사라져요. 저장하려면 리포트를 PDF로 내려받으세요.</span>
      <button class="ml-auto shrink-0 text-amber-500 hover:text-amber-700" onclick={() => { dismissed = true; try { localStorage.setItem('cherrypicker:dismissed-warning', '1'); } catch {} }}>닫기</button>
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
      href={import.meta.env.BASE_URL ?? '/'}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
