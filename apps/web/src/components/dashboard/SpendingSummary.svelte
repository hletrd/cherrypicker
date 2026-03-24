<script lang="ts">
  interface SpendingData {
    totalSpending: number;
    transactionCount: number;
    period: string;
    topCategory: string;
  }

  let data = $state<SpendingData | null>(null);
  let loading = $state(true);

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  $effect(() => {
    // TODO: fetch from API
    loading = false;
    data = {
      totalSpending: 1_850_000,
      transactionCount: 87,
      period: '2026년 2월',
      topCategory: '외식',
    };
  });
</script>

{#if loading}
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if data}
  <div class="mt-4 grid grid-cols-2 gap-4">
    <div class="rounded-lg bg-blue-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">총 지출</div>
      <div class="mt-1 text-2xl font-bold text-[var(--color-primary)]">{formatWon(data.totalSpending)}</div>
    </div>
    <div class="rounded-lg bg-amber-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">거래 건수</div>
      <div class="mt-1 text-2xl font-bold text-amber-600">{data.transactionCount}건</div>
    </div>
    <div class="rounded-lg bg-gray-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">분석 기간</div>
      <div class="mt-1 text-lg font-semibold">{data.period}</div>
    </div>
    <div class="rounded-lg bg-green-50 p-4">
      <div class="text-sm text-[var(--color-text-muted)]">최다 지출 카테고리</div>
      <div class="mt-1 text-lg font-semibold text-green-700">{data.topCategory}</div>
    </div>
  </div>
{:else}
  <div class="flex h-48 items-center justify-center text-[var(--color-text-muted)]">
    명세서를 먼저 업로드하세요
  </div>
{/if}
