<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import {
    collectCapDisclosures,
    collectPortfolioCapLossDisclosures,
    formatCapOutcomeKo,
    formatPortfolioCapLossOutcomeKo,
  } from '../../lib/cap-disclosures.js';
  import { formatWon } from '../../lib/formatters.js';

  let reachEvents = $derived(
    collectCapDisclosures(analysisStore.cardResults),
  );
  let categoryLabels = $derived(new Map(
    (analysisStore.analysisResult?.categoryBreakdown ?? []).map(
      (category) => [category.category, category.categoryNameKo],
    ),
  ));
  let portfolioLosses = $derived(
    collectPortfolioCapLossDisclosures(
      analysisStore.optimization?.portfolioCapLosses,
      categoryLabels,
    ),
  );
</script>

{#if portfolioLosses.length > 0}
  <section
    class="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100"
    aria-labelledby="portfolio-cap-losses-heading"
    data-testid="portfolio-cap-losses"
  >
    <h2 id="portfolio-cap-losses-heading" class="font-semibold">
      한도로 줄어든 최종 혜택
    </h2>
    <p class="mt-1">
      다른 혜택 규칙과 카드를 적용한 뒤에도 남은 월간 혜택 감소분이에요.
    </p>
    <ul class="mt-3 list-disc space-y-1 pl-5">
      {#each portfolioLosses as loss}
        <li data-testid="portfolio-cap-loss-item">
          <strong>{loss.counterfactualCardName}</strong>
          <span> · {loss.categoryLabel}</span>
          <span> · {formatPortfolioCapLossOutcomeKo(loss)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if reachEvents.length > 0}
  <section
    class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    aria-labelledby="cap-reach-events-heading"
    data-testid="cap-reach-events"
  >
    <h2 id="cap-reach-events-heading" class="font-semibold">
      혜택 한도 도달 내역
    </h2>
    <p class="mt-1">
      한도에 도달한 거래별 적용 결과예요. 전체 분석에서 줄어든 최종 혜택과는 별도예요.
    </p>
    <ul class="mt-3 list-disc space-y-1 pl-5">
      {#each reachEvents as disclosure}
        <li data-testid="cap-reach-event-item">
          <strong>{disclosure.cardName}</strong>
          <span> · {disclosure.categoryLabel}</span>
          <span>
            · {disclosure.periodLabel} {formatWon(disclosure.capAmount)} 도달
          </span>
          <span> · 도달 거래 적용 혜택 {formatWon(disclosure.appliedReward)}</span>
          <span> · {formatCapOutcomeKo(disclosure)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}
