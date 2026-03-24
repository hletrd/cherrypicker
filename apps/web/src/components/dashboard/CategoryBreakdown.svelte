<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';

  const CATEGORY_COLORS: Record<string, string> = {
    dining: '#ef4444',
    restaurant: '#ef4444',
    fast_food: '#f87171',
    grocery: '#f97316',
    supermarket: '#f97316',
    online_grocery: '#fb923c',
    convenience_store: '#eab308',
    online_shopping: '#22c55e',
    offline_shopping: '#16a34a',
    department_store: '#15803d',
    public_transit: '#3b82f6',
    subway: '#3b82f6',
    bus: '#60a5fa',
    transportation: '#6366f1',
    taxi: '#818cf8',
    fuel: '#7c3aed',
    telecom: '#8b5cf6',
    streaming: '#a855f7',
    subscription: '#c084fc',
    entertainment: '#ec4899',
    movie: '#f472b6',
    medical: '#14b8a6',
    hospital: '#0d9488',
    pharmacy: '#0f766e',
    education: '#f59e0b',
    academy: '#d97706',
    books: '#b45309',
    cafe: '#92400e',
    travel: '#0ea5e9',
    hotel: '#0284c7',
    airline: '#0369a1',
    utilities: '#6b7280',
    electricity: '#4b5563',
    gas: '#374151',
    water: '#1f2937',
    insurance: '#64748b',
    parking: '#78716c',
    toll: '#a8a29e',
    delivery: '#84cc16',
    fashion: '#e879f9',
    general: '#94a3b8',
    uncategorized: '#d1d5db',
  };

  function formatWon(amount: number): string {
    return amount.toLocaleString('ko-KR') + '원';
  }

  interface CategoryData {
    category: string;
    labelKo: string;
    amount: number;
    percentage: number;
    color: string;
  }

  let categories = $derived.by((): CategoryData[] => {
    const assignments = analysisStore.assignments;
    if (!assignments.length) return [];

    const totalSpending = assignments.reduce((sum, a) => sum + a.spending, 0);
    if (totalSpending === 0) return [];

    return [...assignments]
      .sort((a, b) => b.spending - a.spending)
      .map((a) => ({
        category: a.category,
        labelKo: a.categoryNameKo,
        amount: a.spending,
        percentage: Math.round((a.spending / totalSpending) * 1000) / 10,
        color: CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.uncategorized,
      }));
  });
</script>

{#if analysisStore.loading}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">로딩 중...</div>
{:else if categories.length > 0}
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
{:else}
  <div class="flex h-64 items-center justify-center text-[var(--color-text-muted)]">
    명세서를 업로드하세요
  </div>
{/if}
