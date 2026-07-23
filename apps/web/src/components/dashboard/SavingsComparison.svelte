<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { GROSS_MONTHLY_REWARD_DISCLOSURE } from '../../lib/analysis-disclosures.js';
  import { formatWon, formatRate, formatRatePrecise, getIssuerFromCardId, formatSavingsValue, buildPageUrl } from '../../lib/formatters.js';
  import Icon from '../ui/Icon.svelte';
  import IssuerBadge from '../ui/IssuerBadge.svelte';

  const homeUrl = buildPageUrl('');

  let opt = $derived(analysisStore.optimization);
  let assignments = $derived(analysisStore.assignments);

  // Count unique cards used
  let uniqueCards = $derived.by(() => {
    const ids = new Set(assignments.map((a) => a.assignedCardId));
    return ids.size;
  });

  // Per-card spending/reward breakdown — derived from the optimizer's
  // cardResults instead of re-aggregating assignments, ensuring consistency
  // with the optimizer's computation and eliminating redundant work (C50-05).
  let cardBreakdown = $derived.by(() => {
    const results = analysisStore.cardResults;
    if (!results.length) return [];
    return results.map(cr => ({
      cardId: cr.cardId,
      cardName: cr.cardName,
      spending: cr.totalSpending,
      reward: cr.totalReward,
      rate: cr.effectiveRate,
    })).sort((a, b) => b.reward - a.reward);
  });

  let showBreakdown = $state(false);

  // Count-up animation for savings — smoothly transitions from current
  // displayed value to the new target instead of resetting to 0.
  // Respects prefers-reduced-motion: skips animation and sets value
  // immediately for users who have enabled reduced motion (C22-02).
  let displayedSavings = $state(0);
  // Track the last target value so rapid re-renders animate from the
  // previous target, not a mid-animation intermediate value (C82-02).
  // Plain let instead of $state -- these are only read/written within
  // the same $effect and no other binding depends on them (C83-02).
  let lastTargetSavings = 0;

  $effect(() => {
    const target = opt?.savingsVsSingleCard ?? 0;
    if (target === 0 && displayedSavings === 0) return;
    if (target === lastTargetSavings) return;

    // Skip animation when the user prefers reduced motion
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      displayedSavings = target;
      lastTargetSavings = target;
      return;
    }

    // Always animate from the last target (not the current displayed value)
    // to prevent "dips" during rapid reoptimize clicks (C82-02).
    const startVal = lastTargetSavings;
    lastTargetSavings = target;

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
    // When the best single card earns 0 but cherry-picking earns more, the
    // improvement is "infinite" — return a sentinel so the template can show
    // a special badge instead of hiding the improvement behind 0%.
    //
    // Defensive note (C28-04): In the current optimizer, this branch is
    // unreachable because bestSingleCard.totalReward === 0 implies the
    // optimizer also produces 0 totalReward (both use the same card rules),
    // making savingsVsSingleCard === 0. However, if the optimizer's card
    // selection logic changes (e.g., cards excluded from "best single card"
    // but used by cherry-pick), this guard would become reachable. Kept as a
    // defensive measure.
    if (opt.bestSingleCard.totalReward === 0 && opt.savingsVsSingleCard > 0) {
      // IMPORTANT: `Infinity` is used as a discriminating sentinel value,
      // not a numeric percentage. The template checks `savingsPct === Infinity`
      // to render the "최적 조합만 혜택" badge. Do NOT consume `savingsPct`
      // as a numeric value in ARIA live regions or screen reader announcements
      // without first checking for `Infinity` (C50-02).
      return Infinity;
    }
    if (opt.bestSingleCard.totalReward === 0) return 0;
    const raw = opt.savingsVsSingleCard / opt.bestSingleCard.totalReward;
    return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
  });

  // Bar comparison widths (proportional)
  // When optimizer is optimal (savingsVsSingleCard >= 0): cherry-pick bar is 100%,
  // single-card bar is proportional. When optimizer is suboptimal (< 0): single-card
  // bar is 100% (it gives more), cherry-pick bar is proportional.
  let singleBarWidth = $derived.by(() => {
    if (!opt || opt.totalReward === 0 || !opt.bestSingleCard) return 0;
    if (opt.savingsVsSingleCard < 0) return 100; // single card is better — full width
    const ratio = opt.bestSingleCard.totalReward / opt.totalReward;
    return Math.min(Math.round(ratio * 100), 100);
  });
  let cherrypickBarWidth = $derived.by(() => {
    if (!opt || opt.totalReward === 0 || !opt.bestSingleCard) return 0;
    if (opt.savingsVsSingleCard >= 0) return 100; // cherry-pick is better — full width
    const ratio = opt.totalReward / opt.bestSingleCard.totalReward;
    return Math.min(Math.round(ratio * 100), 100);
  });
</script>

{#if analysisStore.loading}
  <div class="mt-4 grid gap-6 md:grid-cols-3">
    {#each Array(3) as _}
      <div class="animate-pulse space-y-3 rounded-xl border border-[var(--color-border)] p-6">
        <div class="h-4 w-24 rounded bg-[var(--color-border)]"></div>
        <div class="h-8 w-32 rounded bg-[var(--color-border)]"></div>
        <div class="h-4 w-20 rounded bg-[var(--color-border)]"></div>
      </div>
    {/each}
  </div>
{:else if opt && !opt.bestSingleCard}
  <div
    class="mt-4 flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-4 text-center"
    data-testid="savings-no-benefit"
  >
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="banknotes" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text)]">비교할 수 있는 양의 카드 혜택이 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">
      {opt.unassignedTransactionCount}건,
      {formatWon(opt.unassignedSpending)} 모두 계산 가능한 혜택이 0원이어서 임의 배정하지 않았어요.
    </div>
  </div>
{:else if opt}
  <!-- Visual bar comparison — hidden when both rewards are zero (zero-width bars
       look broken and provide no useful information) (C86-07) -->
  {#if opt.totalReward > 0 || (opt.bestSingleCard && opt.bestSingleCard.totalReward > 0)}
  <div class="mt-4 mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <div class="mb-3 text-xs font-medium text-[var(--color-text-muted)]">연회비 차감 전 월간 총혜택 비교</div>
    <div class="space-y-2.5">
      <!-- Single card bar -->
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[6rem_minmax(8rem,1fr)_7rem]">
        <div class="text-xs text-[var(--color-text-muted)]">카드 한 장</div>
        <div class="whitespace-nowrap text-right text-sm font-mono text-[var(--color-text-muted)] sm:order-3">
          {formatWon(opt.bestSingleCard.totalReward)}
        </div>
        <div class="col-span-2 h-6 min-w-[8rem] overflow-hidden rounded-lg bg-[var(--color-bg)] sm:col-span-1 sm:order-2" data-testid="single-card-bar-track">
          <div
            class="h-full rounded-lg bg-[var(--color-border)] transition-all duration-700"
            style="width: {singleBarWidth}%"
          ></div>
        </div>
      </div>
      <!-- Cherry-pick bar (100% when optimal, proportional when suboptimal) -->
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[6rem_minmax(8rem,1fr)_7rem]">
        <div class="text-xs font-semibold text-[var(--color-primary-fg)]">체리피킹</div>
        <div class="whitespace-nowrap text-right text-sm font-mono font-bold text-[var(--color-primary-fg)] sm:order-3">
          {formatWon(opt.totalReward)}
        </div>
        <div class="col-span-2 h-6 min-w-[8rem] overflow-hidden rounded-lg bg-[var(--color-primary-light)] sm:col-span-1 sm:order-2" data-testid="cherrypick-bar-track">
          <div
            class="h-full rounded-lg bg-[var(--color-primary-fill)] transition-all duration-700"
            style="width: {cherrypickBarWidth}%"
          ></div>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Three cards -->
  <div class="grid gap-5 md:grid-cols-3">
    <!-- Left: Single best card -->
    {#if opt.bestSingleCard}
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-xs font-medium text-[var(--color-text-muted)]">카드 한 장 월간 총혜택 (연회비 차감 전)</div>
        {#if opt.bestSingleCard.cardId}
          {@const issuer = getIssuerFromCardId(opt.bestSingleCard.cardId)}
          <IssuerBadge {issuer} />
        {/if}
      </div>
      <div class="text-sm font-semibold text-[var(--color-text)] mb-2">{opt.bestSingleCard.cardName}</div>
      <div class="text-2xl font-bold text-[var(--color-text)]">{formatWon(opt.bestSingleCard.totalReward)}</div>
      <div class="mt-1 text-xs text-[var(--color-text-muted)]">
        월간 총혜택{#if opt.totalSpending > 0}, 연회비 차감 전 혜택률 {formatRatePrecise(opt.bestSingleCard.totalReward / opt.totalSpending)}{/if}
      </div>
    </div>
    {/if}

    <!-- Center: Cherry-pick (highlighted) -->
    <div class="rounded-xl border-2 border-[var(--color-primary-fill)] bg-gradient-to-br from-blue-50 to-blue-100 p-5 dark:from-blue-950 dark:to-blue-900/50 shadow-md">
      <div class="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-fg)]">
        <Icon name="sparkles" size={14} />
        추천 조합 월간 총혜택 (연회비 차감 전)
      </div>
      <div class="text-3xl font-bold text-[var(--color-primary-fg)]">{formatWon(opt.totalReward)}</div>
      <!-- text-blue-600 on from-blue-50/-100 gradient = 5.17:1 (passes WCAG AA
           4.5:1); text-blue-500 was 4.14:1 (fails) — C6UI-22. -->
      <div class="mt-1 text-xs text-blue-600 dark:text-blue-300">
        연회비 차감 전 혜택률 {formatRatePrecise(opt.effectiveRate)}
      </div>
      <div class="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
        {uniqueCards}장 카드 사용
      </div>
    </div>

    <!-- Right: Savings -->
    <div class="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 p-5 dark:from-green-950 dark:to-emerald-900/50">
      <div class="mb-3 text-xs font-medium text-green-700 dark:text-green-400">
        {opt.savingsVsSingleCard >= 0 ? '단일 카드 대비 월간 추가 혜택' : '추천 조합의 월간 혜택 부족분'}
        (연회비 차감 전)
      </div>
      <!-- formatWon normalizes -0 to +0 internally, so displayedSavings >= 0
           correctly determines the sign prefix without Object.is(-0) guard (C12-04).
           Only show '+' when displayedSavings is meaningfully positive (>= 100 won,
           the minimum meaningful amount in Korean banking). Values below 100 during
           animation are just rounding artifacts that would cause a brief "+1원"
           flash before settling to "0원" (C82-03). -->
      <!-- Always show the absolute value of the animated number since the
           direction is communicated by the conditional benefit-difference label.
           Using Math.abs() unconditionally prevents the animated intermediate
           value from contradicting the label during sign transitions (C91-01).
           Previously, Math.abs was conditional on the final target's sign (C83-03),
           but unconditional abs is correct because the label always determines
           the direction and the number should always show magnitude. -->
      <div class="text-3xl font-bold text-green-700 dark:text-green-400">{formatSavingsValue(displayedSavings, opt.savingsVsSingleCard)}</div>
      {#if savingsPct === Infinity}
        <!-- Defensive badge (C28-04): currently unreachable — see savingsPct comment -->
        <div class="mt-2 inline-block rounded-full bg-green-200 dark:bg-green-800 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200">
          최적 조합만 혜택
        </div>
      {:else if savingsPct > 0}
        <div class="mt-2 inline-block rounded-full bg-green-200 dark:bg-green-800 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200">
          한 장짜리보다 +{savingsPct}%
        </div>
      {:else if savingsPct < 0}
        <div class="mt-2 inline-block rounded-full bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
          단일 카드가 더 유리
        </div>
      {/if}
    </div>
  </div>
  <p
    class="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-xs text-[var(--color-text-muted)]"
    data-testid="gross-reward-disclosure"
  >
    {GROSS_MONTHLY_REWARD_DISCLOSURE}
  </p>
  {#if opt.unassignedTransactionCount > 0}
    <p
      class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      data-testid="savings-unassigned-spending"
    >
      계산 가능한 양의 혜택이 없는 {opt.unassignedTransactionCount}건,
      {formatWon(opt.unassignedSpending)}은 추천 조합에 배정하지 않았어요.
    </p>
  {/if}

  <!-- Breakdown toggle -->
  <div class="mt-5">
    <button
      type="button"
      class="flex min-h-11 items-center gap-2 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:underline print:hidden"
      aria-expanded={showBreakdown}
      aria-controls="card-benefit-breakdown"
      onclick={() => (showBreakdown = !showBreakdown)}
    >
      <span aria-hidden="true" class="transition-transform duration-200 inline-block {showBreakdown ? 'rotate-90' : ''}">▶</span>
      카드별 상세 보기
    </button>

      <div
        id="card-benefit-breakdown"
        class:hidden={!showBreakdown}
        class="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] print:block"
      >
        <div class="space-y-3 p-3 md:hidden print:hidden">
          {#each cardBreakdown as card}
            {@const issuer = getIssuerFromCardId(card.cardId)}
            <article class="rounded-lg border border-[var(--color-border)] p-3">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <IssuerBadge {issuer} />
                <h3 class="min-w-0 break-keep [overflow-wrap:anywhere] text-sm font-semibold">{card.cardName}</h3>
              </div>
              <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt class="text-[var(--color-text-muted)]">해당 지출</dt>
                <dd class="text-right font-mono">{formatWon(card.spending)}</dd>
                <dt class="text-[var(--color-text-muted)]">월간 혜택 (연회비 차감 전)</dt>
                <dd class="text-right font-mono font-semibold text-[var(--color-primary-fg)]">{formatWon(card.reward)}</dd>
                <dt class="text-[var(--color-text-muted)]">연회비 차감 전 혜택률</dt>
                <dd class="text-right font-mono">{formatRate(card.rate)}</dd>
              </dl>
            </article>
          {/each}
        </div>
        <table class="hidden w-full text-sm md:table print:table">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-left text-xs text-[var(--color-text-muted)]">
              <th scope="col" class="px-4 py-2.5 font-medium">카드명</th>
              <th scope="col" class="px-4 py-2.5 text-right font-medium">해당 지출</th>
              <th scope="col" class="px-4 py-2.5 text-right font-medium">월간 혜택 (연회비 차감 전)</th>
              <th scope="col" class="px-4 py-2.5 text-right font-medium">연회비 차감 전 혜택률</th>
            </tr>
          </thead>
          <tbody>
            {#each cardBreakdown as card}
              {@const issuer = getIssuerFromCardId(card.cardId)}
              <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2"><IssuerBadge {issuer} /><span class="font-medium">{card.cardName}</span></div>
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs">{formatWon(card.spending)}</td>
                <td class="px-4 py-3 text-right font-mono text-xs font-semibold text-[var(--color-primary-fg)]">
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
  </div>
{:else}
  <div class="mt-4 flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)]">
    <div class="opacity-40 text-[var(--color-text-muted)]">
      <Icon name="banknotes" size={40} />
    </div>
    <div class="text-sm font-medium text-[var(--color-text-muted)]">아직 비교 데이터가 없어요</div>
    <div class="text-xs text-[var(--color-text-muted)]">명세서를 올리면 월간 총혜택 차이를 보여줘요</div>
    <a
      href={homeUrl}
      class="mt-3 inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-fill)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-fill-hover)] transition-colors"
    >
      명세서 올리러 가기
    </a>
  </div>
{/if}
