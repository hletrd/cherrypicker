<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  function formatPeriod(period: { start: string; end: string } | undefined): string {
    if (!period) return '-';
    const start = new Date(period.start);
    const end = new Date(period.end);
    const startStr = `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
    const endStr = `${end.getFullYear()}년 ${end.getMonth() + 1}월`;
    return startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
  }

  function getTopCategory(assignments: typeof analysisStore.assignments): string {
    if (!assignments.length) return '-';
    const top = [...assignments].sort((a, b) => b.spending - a.spending)[0];
    return top.categoryNameKo;
  }
</script>

{#if analysisStore.loading}
  <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
    {#each Array(5) as _}
      <div class="animate-pulse rounded-xl bg-gray-100 p-4">
        <div class="mb-2 h-4 w-16 rounded bg-gray-200"></div>
        <div class="h-7 w-24 rounded bg-gray-300"></div>
      </div>
    {/each}
  </div>
{:else if analysisStore.result}
  <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
    <!-- 총 지출 -->
    <div class="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-sm">
      <div class="flex items-center gap-1.5 text-sm text-blue-500">
        <Icon name="credit-card" size={15} />
        <span>총 지출</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-[var(--color-primary)]">
        {formatWon(analysisStore.optimization?.totalSpending ?? 0)}
      </div>
    </div>

    <!-- 거래 건수 -->
    <div class="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm">
      <div class="flex items-center gap-1.5 text-sm text-amber-500">
        <Icon name="receipt" size={15} />
        <span>거래 건수</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-amber-600">
        {analysisStore.transactionCount}건
      </div>
    </div>

    <!-- 분석 기간 -->
    <div class="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 shadow-sm">
      <div class="flex items-center gap-1.5 text-sm text-gray-500">
        <Icon name="calendar" size={15} />
        <span>분석 기간</span>
      </div>
      <div class="mt-1 text-lg font-semibold text-gray-800">
        {formatPeriod(analysisStore.statementPeriod)}
      </div>
    </div>

    <!-- 최다 지출 카테고리 -->
    <div class="rounded-xl bg-gradient-to-br from-green-50 to-green-100 p-4 shadow-sm">
      <div class="flex items-center gap-1.5 text-sm text-green-600">
        <Icon name="tag" size={15} />
        <span>최다 지출 카테고리</span>
      </div>
      <div class="mt-1 text-lg font-semibold text-green-700">
        {getTopCategory(analysisStore.assignments)}
      </div>
    </div>

    <!-- 실효 혜택률 -->
    <div class="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 shadow-sm">
      <div class="flex items-center gap-1.5 text-sm text-purple-500">
        <Icon name="percent" size={15} />
        <span>실효 혜택률</span>
      </div>
      <div class="mt-1 text-2xl font-bold text-purple-700">
        {analysisStore.optimization ? (analysisStore.optimization.effectiveRate * 100).toFixed(2) + '%' : '-'}
      </div>
    </div>
  </div>
{:else}
  <div class="mt-4 flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] text-center">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="folder-open" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">분석 결과가 없습니다</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 업로드하면 지출 요약이 표시됩니다</div>
  </div>
{/if}
