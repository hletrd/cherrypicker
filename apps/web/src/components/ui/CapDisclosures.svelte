<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import {
    collectCapDisclosures,
    formatCapOutcomeKo,
  } from '../../lib/cap-disclosures.js';
  import { formatWon } from '../../lib/formatters.js';

  let disclosures = $derived(
    collectCapDisclosures(analysisStore.cardResults),
  );
</script>

{#if disclosures.length > 0}
  <section
    class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    aria-labelledby="cap-disclosures-heading"
    data-testid="cap-disclosures"
  >
    <h2 id="cap-disclosures-heading" class="font-semibold">
      혜택 한도 도달 내역
    </h2>
    <p class="mt-1">
      한도가 적용된 혜택과 한도 때문에 받지 못한 금액을 확인해 주세요.
    </p>
    <ul class="mt-3 list-disc space-y-1 pl-5">
      {#each disclosures as disclosure}
        <li data-testid="cap-disclosure-item">
          <strong>{disclosure.cardName}</strong>
          <span> · {disclosure.categoryLabel}</span>
          <span>
            · {disclosure.periodLabel} {formatWon(disclosure.capAmount)} 도달
          </span>
          <span> · 적용 혜택 {formatWon(disclosure.appliedReward)}</span>
          <span> · {formatCapOutcomeKo(disclosure)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}
