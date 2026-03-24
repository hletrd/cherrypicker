<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  let opt = $derived(analysisStore.optimization);
</script>

{#if analysisStore.loading}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if opt}
  <div class="grid gap-6 md:grid-cols-3">
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div class="text-sm text-[var(--color-text-muted)]">단일 카드 최고 혜택</div>
      <div class="mt-1 text-sm font-medium">{opt.bestSingleCard.cardName}</div>
      <div class="mt-2 text-2xl font-bold">{formatWon(opt.bestSingleCard.totalReward)}</div>
      <div class="text-sm text-[var(--color-text-muted)]">
        월 혜택
        {#if opt.totalSpending > 0}
          ({((opt.bestSingleCard.totalReward / opt.totalSpending) * 100).toFixed(2)}%)
        {/if}
      </div>
    </div>

    <div class="rounded-xl border-2 border-[var(--color-primary)] bg-blue-50 p-6">
      <div class="text-sm font-medium text-[var(--color-primary)]">체리피킹 혜택</div>
      <div class="mt-3 text-3xl font-bold text-[var(--color-primary)]">{formatWon(opt.totalReward)}</div>
      <div class="text-sm text-[var(--color-text-muted)]">
        월 혜택 ({(opt.effectiveRate * 100).toFixed(2)}%)
      </div>
    </div>

    <div class="rounded-xl border border-green-200 bg-green-50 p-6">
      <div class="text-sm text-green-700">추가 절약</div>
      <div class="mt-3 text-3xl font-bold text-green-700">+{formatWon(opt.savingsVsSingleCard)}</div>
      <div class="mt-2 text-sm text-green-600">연간 약 {formatWon(opt.savingsVsSingleCard * 12)} 절약</div>
    </div>
  </div>
{:else}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">
    명세서를 업로드하세요
  </div>
{/if}
