<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

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
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if analysisStore.result}
  <div class="mt-4 grid grid-cols-2 gap-4">
    <div class="rounded-lg bg-blue-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">총 지출</div>
      <div class="mt-1 text-2xl font-bold text-[var(--color-primary)]">
        {formatWon(analysisStore.optimization?.totalSpending ?? 0)}
      </div>
    </div>
    <div class="rounded-lg bg-amber-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">거래 건수</div>
      <div class="mt-1 text-2xl font-bold text-amber-600">
        {analysisStore.transactionCount}건
      </div>
    </div>
    <div class="rounded-lg bg-gray-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">분석 기간</div>
      <div class="mt-1 text-lg font-semibold">
        {formatPeriod(analysisStore.statementPeriod)}
      </div>
    </div>
    <div class="rounded-lg bg-green-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">최다 지출 카테고리</div>
      <div class="mt-1 text-lg font-semibold text-green-700">
        {getTopCategory(analysisStore.assignments)}
      </div>
    </div>
  </div>
{:else}
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">
    명세서를 먼저 업로드하세요
  </div>
{/if}
