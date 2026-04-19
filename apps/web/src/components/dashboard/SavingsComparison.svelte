<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatRate, formatRatePrecise, getIssuerColor, getIssuerFromCardId } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';

  let opt = $derived(analysisStore.optimization);
  let assignments = $derived(analysisStore.assignments);

  // Count unique cards used
  let uniqueCards = $derived.by(() => {
    const ids = new Set(assignments.map((a) => a.assignedCardId));
    return ids.size;
  });

  // Per-card spending/reward breakdown
  interface CardBreakdown {
    cardId: string;
    cardName: string;
    spending: number;
    reward: number;
    rate: number;
  }

  let cardBreakdown = $derived.by((): CardBreakdown[] => {
    if (!assignments.length) return [];
    const map = new Map<string, CardBreakdown>();
    for (const a of assignments) {
      const existing = map.get(a.assignedCardId);
      if (existing) {
        existing.spending += a.spending;
        existing.reward += a.reward;
      } else {
        map.set(a.assignedCardId, {
          cardId: a.assignedCardId,
          cardName: a.assignedCardName,
          spending: a.spending,
          reward: a.reward,
        });
      }
    }
    return [...map.values()].map(entry => ({
      ...entry,
      rate: entry.spending > 0 ? entry.reward / entry.spending : 0,
    })).sort((a, b) => b.reward - a.reward);
  });

  let showBreakdown = $state(false);

  // Count-up animation for savings — smoothly transitions from current
  // displayed value to the new target instead of resetting to 0
  let displayedSavings = $state(0);

  $effect(() => {
    const target = opt?.savingsVsSingleCard ?? 0;
    if (target === 0) { displayedSavings = 0; return; }
    const startVal = displayedSavings;
    let cancelled = false;
    let rafId: number;
    const start = performance.now();
    const duration = 600;
    function tick(now: number) {
      if (cancelled) return;
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      displayedSavings = Math.round(startVal + (target - startVal) * eased);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  });

  let savingsPct = $derived.by(() => {
    if (!opt || !opt.bestSingleCard) return 0;
    const raw = opt.savingsVsSingleCard / opt.bestSingleCard.totalReward;
    return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
  });

  // Bar comparison widths (proportional)
  let singleBarWidth = $derived.by(() => {
    if (!opt || opt.totalReward === 0 || !opt.bestSingleCard) return 0;
    const ratio = opt.bestSingleCard.totalReward / opt.totalReward;
    return Math.min(Math.round(ratio * 100), 100);
  });
</script>

{#if analysisStore.loading}
  <div class="mt-4 grid gap-6 md:grid-cols-3">
    {#each Array(3) as _}
      <div class="animate-pulse rounded-xl border border-gray-100 p-6 space-y-3">
        <div class="h-4 w-24 rounded bg-gray-200"></div>
        <div class="h-8 w-32 rounded bg-gray-300"></div>
        <div class="h-4 w-20 rounded bg-gray-200"></div>
      </div>
    {/each}
  </div>
{:else if opt}
  <!-- Visual bar comparison -->
  <div class="mt-4 mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <div class="mb-3 text-xs font-medium text-[var(--color-text-muted)]">혜택 비교</div>
    <div class="space-y-2.5">
      <!-- Single card bar -->
      <div class="flex items-center gap-3">
        <div class="w-24 shrink-0 text-xs text-[var(--color-text-muted)]">카드 한 장</div>
        <div class="flex-1 h-6 overflow-hidden rounded-lg bg-[var(--color-bg)]">
          <div
            class="h-full rounded-lg bg-[var(--color-border)] transition-all duration-700"
            style="width: {singleBarWidth}%"
          ></div>
        </div>
        <div class="w-28 shrink-0 text-right text-sm font-mono text-[var(--color-text-muted)]">
          {formatWon(opt.bestSingleCard.totalReward)}
        </div>
      </div>
      <!-- Cherry-pick bar (always 100%) -->
      <div class="flex items-center gap-3">
        <div class="w-24 shrink-0 text-xs font-semibold text-[var(--color-primary)]">체리피킹</div>
        <div class="flex-1 h-6 overflow-hidden rounded-lg bg-[var(--color-primary-light)]">
          <div
            class="h-full rounded-lg bg-[var(--color-primary)] transition-all duration-700"
            style="width: 100%"
          ></div>
        </div>
        <div class="w-28 shrink-0 text-right text-sm font-mono font-bold text-[var(--color-primary)]">
          {formatWon(opt.totalReward)}
        </div>
      </div>
    </div>
  </div>

  <!-- Three cards -->
  <div class="grid gap-5 md:grid-cols-3">
    <!-- Left: Single best card -->
    {#if opt.bestSingleCard}
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-xs font-medium text-[var(--color-text-muted)]">카드 한 장으로 받는 혜택</div>
        {#if opt.bestSingleCard.cardId}
          {@const issuer = getIssuerFromCardId(opt.bestSingleCard.cardId)}
          <span
            class="rounded-full px-2 py-0.5 text-xs text-white"
            style="background-color: {getIssuerColor(issuer)}"
          >
            {issuer.toUpperCase()}
          </span>
        {/if}
      </div>
      <div class="text-sm font-semibold text-[var(--color-text)] mb-2">{opt.bestSingleCard.cardName}</div>
      <div class="text-2xl font-bold text-[var(--color-text)]">{formatWon(opt.bestSingleCard.totalReward)}</div>
      <div class="mt-1 text-xs text-[var(--color-text-muted)]">
        월 혜택{#if opt.totalSpending > 0}, 혜택률 {formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)}{/if}
      </div>
    </div>
    {/if}

    <!-- Center: Cherry-pick (highlighted) -->
    <div class="rounded-xl border-2 border-[var(--color-primary)] bg-gradient-to-br from-blue-50 to-blue-100 p-5 dark:from-blue-950 dark:to-blue-900/50 shadow-md">
      <div class="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)]">
        <Icon name="sparkles" size={14} />
        체리피킹 혜택
      </div>
      <div class="text-3xl font-bold text-[var(--color-primary)]">{formatWon(opt.totalReward)}</div>
      <div class="mt-1 text-xs text-blue-500 dark:text-blue-400">
        실효 혜택률 {formatRatePrecise(opt.effectiveRate)}
      </div>
      <div class="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
        {uniqueCards}장 카드 사용
      </div>
    </div>

    <!-- Right: Savings -->
    <div class="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 p-5 dark:from-green-950 dark:to-emerald-900/50">
      <div class="mb-3 text-xs font-medium text-green-700 dark:text-green-400">추가 절약</div>
      <div class="text-3xl font-bold text-green-700 dark:text-green-400">{displayedSavings >= 0 ? '+' : ''}{formatWon(displayedSavings)}</div>
      <div class="mt-1 text-xs text-green-600 dark:text-green-400">
        연간 약 {formatWon(opt.savingsVsSingleCard * 12)} {opt.savingsVsSingleCard >= 0 ? '절약' : '추가 비용'}
      </div>
      {#if savingsPct > 0}
        <div class="mt-2 inline-block rounded-full bg-green-200 dark:bg-green-800 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200">
          한 장짜리보다 +{savingsPct}%
        </div>
      {/if}
    </div>
  </div>

  <!-- Breakdown toggle -->
  <div class="mt-5">
    <button
      class="flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
      onclick={() => (showBreakdown = !showBreakdown)}
    >
      <span class="transition-transform duration-200 inline-block {showBreakdown ? 'rotate-90' : ''}">▶</span>
      카드별 상세 보기
    </button>

    {#if showBreakdown}
      <div class="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
              <th class="px-4 py-2.5 font-medium">카드명</th>
              <th class="px-4 py-2.5 text-right font-medium">해당 지출</th>
              <th class="px-4 py-2.5 text-right font-medium">예상 혜택</th>
              <th class="px-4 py-2.5 text-right font-medium">혜택률</th>
            </tr>
          </thead>
          <tbody>
            {#each cardBreakdown as card}
              {@const issuer = getIssuerFromCardId(card.cardId)}
              {@const issuerColor = getIssuerColor(issuer)}
              <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
                <td class="px-4 py-3">
                  <span
                    class="inline-block rounded-full px-2 py-0.5 text-xs text-white"
                    style="background-color: {issuerColor}"
                  >
                    {card.cardName}
                  </span>
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs">{formatWon(card.spending)}</td>
                <td class="px-4 py-3 text-right font-mono text-xs font-semibold text-[var(--color-primary)]">
                  {formatWon(card.reward)}
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-[var(--color-text-muted)]">
                  {formatRate(card.rate)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{:else}
  <div class="mt-4 flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)]">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="banknotes" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">아직 비교 데이터가 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 올리면 얼마나 아끼는지 보여줘요</div>
    <a
      href={import.meta.env.BASE_URL ?? '/'}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
