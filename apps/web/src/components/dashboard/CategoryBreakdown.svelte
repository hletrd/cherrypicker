<script lang="ts">
  interface CategoryData {
    category: string;
    labelKo: string;
    amount: number;
    percentage: number;
    color: string;
  }

  let categories = $state<CategoryData[]>([]);
  let loading = $state(true);

  const CATEGORY_COLORS: Record<string, string> = {
    dining: '#ef4444',
    grocery: '#f97316',
    convenience_store: '#eab308',
    online_shopping: '#22c55e',
    public_transit: '#3b82f6',
    transportation: '#6366f1',
    telecom: '#8b5cf6',
    entertainment: '#ec4899',
    medical: '#14b8a6',
    education: '#f59e0b',
    utilities: '#6b7280',
    uncategorized: '#d1d5db',
  };

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  $effect(() => {
    // TODO: fetch from API
    loading = false;
    categories = [
      { category: 'dining', labelKo: '외식', amount: 520000, percentage: 28.1, color: CATEGORY_COLORS.dining },
      { category: 'grocery', labelKo: '식료품', amount: 380000, percentage: 20.5, color: CATEGORY_COLORS.grocery },
      { category: 'online_shopping', labelKo: '온라인쇼핑', amount: 310000, percentage: 16.8, color: CATEGORY_COLORS.online_shopping },
      { category: 'public_transit', labelKo: '대중교통', amount: 180000, percentage: 9.7, color: CATEGORY_COLORS.public_transit },
      { category: 'convenience_store', labelKo: '편의점', amount: 120000, percentage: 6.5, color: CATEGORY_COLORS.convenience_store },
      { category: 'telecom', labelKo: '통신', amount: 95000, percentage: 5.1, color: CATEGORY_COLORS.telecom },
      { category: 'entertainment', labelKo: '여가/문화', amount: 85000, percentage: 4.6, color: CATEGORY_COLORS.entertainment },
      { category: 'uncategorized', labelKo: '기타', amount: 160000, percentage: 8.6, color: CATEGORY_COLORS.uncategorized },
    ];
  });
</script>

{#if loading}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else}
  <div class="mt-4 space-y-3">
    {#each categories as cat}
      <div class="flex items-center gap-3">
        <div class="w-20 text-sm font-medium">{cat.labelKo}</div>
        <div class="flex-1">
          <div class="h-6 overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full transition-all duration-500"
              style="width: {cat.percentage}%; background-color: {cat.color}"
            ></div>
          </div>
        </div>
        <div class="w-28 text-right text-sm">{formatWon(cat.amount)}</div>
        <div class="w-12 text-right text-xs text-[var(--color-text-muted)]">{cat.percentage}%</div>
      </div>
    {/each}
  </div>
{/if}
