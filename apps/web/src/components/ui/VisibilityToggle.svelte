<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon } from '../../lib/formatters.js';

  interface Props {
    dataContentId: string;
    emptyStateId: string;
  }

  let { dataContentId, emptyStateId }: Props = $props();

  function formatWonStat(amount: number): string {
    return Number.isFinite(amount) ? amount.toLocaleString('ko-KR') + '원' : '0원';
  }

  // When the store has optimization results, show the data content and hide
  // the empty state. This replaces the inline <script is:inline> pattern
  // that read from sessionStorage independently, eliminating the split-brain
  // where Svelte components read from the store but the container visibility
  // was managed by plain JS. Also populates the results page stat elements
  // that were previously filled by the inline script.
  $effect(() => {
    const opt = analysisStore.result?.optimization;
    const hasData = opt !== undefined;
    const dataEl = document.getElementById(dataContentId);
    const emptyEl = document.getElementById(emptyStateId);
    if (dataEl) dataEl.classList.toggle('hidden', !hasData);
    if (emptyEl) emptyEl.classList.toggle('hidden', hasData);

    // Populate results page summary stats from the store
    if (hasData) {
      const totalSpending = document.getElementById('stat-total-spending');
      const totalSavings = document.getElementById('stat-total-savings');
      const cardsNeeded = document.getElementById('stat-cards-needed');

      if (totalSpending) totalSpending.textContent = formatWonStat(opt.totalSpending);
      if (totalSavings) {
        totalSavings.textContent = (opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWonStat(opt.savingsVsSingleCard);
      }
      if (cardsNeeded) {
        const uniqueCards = new Set(opt.assignments.map((a: { assignedCardId: string }) => a.assignedCardId)).size;
        cardsNeeded.textContent = uniqueCards + '장';
      }

      // Update savings label to "추가 비용" when cherry-picking is worse
      const savingsLabel = document.getElementById('stat-savings-label');
      if (savingsLabel && opt.savingsVsSingleCard < 0) {
        savingsLabel.textContent = '추가 비용';
      }
    }
  });
</script>
