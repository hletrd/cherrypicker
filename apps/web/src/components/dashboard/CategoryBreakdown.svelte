<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, buildPageUrl } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  const homeUrl = buildPageUrl('');

  const CATEGORY_COLORS: Record<string, string> = {
    // Parent categories
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
    travel_agency: '#0ea5e9',
    utilities: '#6b7280',
    electricity: '#facc15',
    gas: '#fb923c',
    water: '#38bdf8',
    insurance: '#a78bfa',
    parking: '#78716c',
    toll: '#a8a29e',
    delivery: '#84cc16',
    fashion: '#e879f9',
    general: '#94a3b8',
    uncategorized: '#d1d5db',

    // Dot-notation subcategory keys — ensure getCategoryColor() finds a match
    // for the fully-qualified keys used by the optimizer instead of falling
    // back to gray (C81-04). Colors match the corresponding leaf ID above.
    'dining.restaurant': '#ef4444',
    'dining.cafe': '#92400e',
    'dining.fast_food': '#f87171',
    'dining.delivery': '#84cc16',
    'grocery.supermarket': '#f97316',
    'grocery.traditional_market': '#f97316',
    'grocery.online_grocery': '#fb923c',
    'grocery.convenience_store': '#eab308',
    'online_shopping.general': '#22c55e',
    'online_shopping.fashion': '#e879f9',
    'offline_shopping.department_store': '#15803d',
    'public_transit.subway': '#3b82f6',
    'public_transit.bus': '#60a5fa',
    'public_transit.taxi': '#818cf8',
    'transportation.fuel': '#7c3aed',
    'transportation.parking': '#78716c',
    'transportation.toll': '#a8a29e',
    'medical.hospital': '#0d9488',
    'medical.pharmacy': '#0f766e',
    'education.academy': '#d97706',
    'education.books': '#b45309',
    'entertainment.movie': '#f472b6',
    'entertainment.streaming': '#a855f7',
    'entertainment.subscription': '#c084fc',
    'travel.hotel': '#0284c7',
    'travel.airline': '#0369a1',
    'utilities.electricity': '#facc15',
    'utilities.gas': '#fb923c',
    'utilities.water': '#38bdf8',
    'utilities.apartment_mgmt': '#6b7280',
  };

  const OTHER_COLOR = '#cbd5e1';

  /** Look up the color for a category key, handling dot-notation subcategory
   *  keys like "dining.cafe" — try the full key first, then the leaf ID
   *  ("cafe"), then fall back to the uncategorized color. */
  function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category]
      ?? CATEGORY_COLORS[category.split('.').pop() ?? '']
      ?? CATEGORY_COLORS.uncategorized
      ?? OTHER_COLOR;
  }

  interface CategoryData {
    category: string;
    labelKo: string;
    amount: number;
    percentage: number;
    color: string;
    isOther?: boolean;
    subCategories?: { labelKo: string; amount: number; percentage: number }[];
  }

  let hoveredIndex = $state<number | null>(null);

  let categories = $derived.by((): CategoryData[] => {
    const assignments = analysisStore.assignments;
    if (!assignments.length) return [];

    const totalSpending = assignments.reduce((sum, a) => sum + a.spending, 0);
    if (totalSpending === 0) return [];

    const sorted = [...assignments].sort((a, b) => b.spending - a.spending);

    const main: CategoryData[] = [];
    const others: typeof sorted = [];

    for (const a of sorted) {
      const rawPct = (a.spending / totalSpending) * 100;
      const pct = Math.round(rawPct * 10) / 10;
      // Use the rounded percentage for the threshold decision so the
      // grouping matches the displayed value: a category showing 2.0%
      // stays visible, while 1.9% goes into "other" (C89-02).
      if (pct < 2) {
        others.push(a);
      } else {
        main.push({
          category: a.category,
          labelKo: a.categoryNameKo,
          amount: a.spending,
          percentage: pct,
          color: getCategoryColor(a.category),
        });
      }
    }

    if (others.length > 0) {
      const otherTotal = others.reduce((s, a) => s + a.spending, 0);
      const otherPct = Math.round((otherTotal / totalSpending) * 1000) / 10;
      main.push({
        category: 'other',
        labelKo: '기타',
        amount: otherTotal,
        percentage: otherPct,
        color: OTHER_COLOR,
        isOther: true,
        subCategories: others.map((a) => ({
          labelKo: a.categoryNameKo,
          amount: a.spending,
          percentage: Math.round((a.spending / totalSpending) * 1000) / 10,
        })),
      });
    }

    return main;
  });

  let topCategoryName = $derived(categories.length > 0 ? categories[0].labelKo : '-');
  // Use 0 as the reduce initial value so that sub-1% categories get
  // proportionally small bars instead of appearing full-width (the old
  // initial value of 1 made bars fill 100% when all categories were < 1%).
  // The `|| 1` fallback prevents division-by-zero when all percentages are 0.
  let maxPercentage = $derived(categories.length > 0 ? categories.reduce((max, c) => Math.max(max, c.percentage), 0) || 1 : 100);
</script>

{#if analysisStore.loading}
  <div class="mt-4 space-y-3">
    {#each [80, 60, 45, 70, 35, 55] as w}
      <div class="animate-pulse flex items-center gap-3">
        <div class="h-4 w-5 rounded bg-gray-200"></div>
        <div class="h-4 w-20 rounded bg-gray-200"></div>
        <div class="flex-1">
          <div class="h-6 rounded-lg bg-gray-200" style="width: {w}%"></div>
        </div>
        <div class="h-4 w-24 rounded bg-gray-200"></div>
        <div class="h-4 w-10 rounded bg-gray-200"></div>
      </div>
    {/each}
  </div>
{:else if categories.length > 0}
  <!-- Summary row -->
  <div class="mt-4 mb-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
    <span>총 <strong class="text-[var(--color-text)]">{categories.length}개</strong> 항목</span>
    <span class="text-[var(--color-border)]">·</span>
    <span>가장 많이 쓴 곳: <strong class="text-[var(--color-text)]">{topCategoryName}</strong></span>
  </div>

  <div class="space-y-2">
    {#each categories as cat, i}
      {@const isTop3 = i < 3}
      <div
        class="relative rounded-lg px-3 py-2 transition-colors duration-150 cursor-default focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 {isTop3 ? 'bg-[var(--color-bg)]' : ''} {hoveredIndex === i ? 'bg-[var(--color-primary-light)]' : ''}"
        role="button"
        tabindex="0"
        aria-label={cat.labelKo}
        aria-expanded={hoveredIndex === i}
        onmouseenter={() => (hoveredIndex = i)}
        onmouseleave={() => (hoveredIndex = null)}
        onfocusin={() => (hoveredIndex = i)}
        onfocusout={(e) => {
          // Only collapse if focus is leaving this row entirely (not moving to a child)
          if (!e.currentTarget?.contains(e.relatedTarget as Node)) {
            hoveredIndex = null;
          }
        }}
        onclick={() => (hoveredIndex = hoveredIndex === i ? null : i)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hoveredIndex = hoveredIndex === i ? null : i; } }}
      >
        <div class="flex items-center gap-3">
          <!-- Rank -->
          <div class="w-5 text-center text-xs font-bold {i < 3 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}">
            {cat.isOther ? '…' : i + 1}
          </div>

          <!-- Color legend dot + label -->
          <div class="flex w-24 items-center gap-1.5 shrink-0">
            <span class="inline-block h-2.5 w-2.5 rounded-full shrink-0" style="background-color: {cat.color}"></span>
            <span class="truncate text-sm font-medium">{cat.labelKo}</span>
          </div>

          <!-- Bar -->
          <div class="flex-1 relative">
            <div class="h-6 overflow-hidden rounded-lg bg-[var(--color-bg)] shadow-inner">
              <div
                class="h-full rounded-lg transition-all duration-700 ease-out"
                style="width: {(cat.percentage / maxPercentage) * 100}%; background-color: {cat.color}; opacity: {hoveredIndex === i ? 1 : 0.8}"
              ></div>
            </div>
          </div>

          <!-- Amount -->
          <div class="w-28 text-right text-sm font-medium">{formatWon(cat.amount)}</div>

          <!-- Percentage -->
          <div class="w-12 text-right text-xs font-semibold {i < 3 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}">
            {cat.percentage}%
          </div>
        </div>

        <!-- Hover tooltip expansion -->
        {#if hoveredIndex === i}
          <div class="mt-2 ml-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-md">
            <div class="flex justify-between gap-8">
              <span class="text-[var(--color-text-muted)]">정확한 금액</span>
              <span class="font-semibold">{formatWon(cat.amount)}</span>
            </div>
            <div class="flex justify-between gap-8">
              <span class="text-[var(--color-text-muted)]">전체 지출 비중</span>
              <span class="font-semibold">{cat.percentage}%</span>
            </div>
            {#if cat.isOther && cat.subCategories}
              <div class="mt-1.5 border-t border-[var(--color-border)] pt-1.5 space-y-0.5">
                {#each cat.subCategories as sub}
                  <div class="flex justify-between gap-8 text-[var(--color-text-muted)]">
                    <span>{sub.labelKo}</span>
                    <span>{formatWon(sub.amount)} ({sub.percentage}%)</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="mt-4 flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)]">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="chart-bar" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">아직 분석한 내역이 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 올려 보세요</div>
    <a
      href={homeUrl}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
