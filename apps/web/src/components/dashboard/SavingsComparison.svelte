<script lang="ts">
  interface ComparisonData {
    singleCardBest: { name: string; reward: number; rate: number };
    cherryPicked: { reward: number; rate: number };
    savings: number;
    annualSavings: number;
  }

  let data = $state<ComparisonData | null>(null);
  let loading = $state(true);

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  $effect(() => {
    // TODO: fetch from optimizer API
    loading = false;
    data = {
      singleCardBest: { name: 'the Green Edition2', reward: 15200, rate: 0.0082 },
      cherryPicked: { reward: 23300, rate: 0.0126 },
      savings: 8100,
      annualSavings: 97200,
    };
  });
</script>

{#if loading}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if data}
  <div class="grid gap-6 md:grid-cols-3">
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div class="text-sm text-[var(--color-text-muted)]">단일 카드 최고 혜택</div>
      <div class="mt-1 text-sm font-medium">{data.singleCardBest.name}</div>
      <div class="mt-2 text-2xl font-bold">{formatWon(data.singleCardBest.reward)}</div>
      <div class="text-sm text-[var(--color-text-muted)]">월 혜택 ({(data.singleCardBest.rate * 100).toFixed(2)}%)</div>
    </div>

    <div class="rounded-xl border-2 border-[var(--color-primary)] bg-blue-50 p-6">
      <div class="text-sm font-medium text-[var(--color-primary)]">체리피킹 혜택</div>
      <div class="mt-3 text-3xl font-bold text-[var(--color-primary)]">{formatWon(data.cherryPicked.reward)}</div>
      <div class="text-sm text-[var(--color-text-muted)]">월 혜택 ({(data.cherryPicked.rate * 100).toFixed(2)}%)</div>
    </div>

    <div class="rounded-xl border border-green-200 bg-green-50 p-6">
      <div class="text-sm text-green-700">추가 절약</div>
      <div class="mt-3 text-3xl font-bold text-green-700">+{formatWon(data.savings)}</div>
      <div class="mt-2 text-sm text-green-600">연간 약 {formatWon(data.annualSavings)} 절약</div>
    </div>
  </div>
{/if}
