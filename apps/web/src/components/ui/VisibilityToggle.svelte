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
  //
  // C18-01/C18-02 fix: The effect now provides cleanup that restores the
  // empty state when the store is reset, and skips stat-element population
  // when the results page is not mounted (those elements won't exist).
  $effect(() => {
    const opt = analysisStore.result?.optimization;
    const hasData = opt !== undefined;
    const dataEl = document.getElementById(dataContentId);
    const emptyEl = document.getElementById(emptyStateId);
    if (dataEl) dataEl.classList.toggle('hidden', !hasData);
    if (emptyEl) emptyEl.classList.toggle('hidden', hasData);

    // Populate results page summary stats from the store.
    // Only run when the stat elements exist (results page is mounted).
    // On the dashboard page these elements are absent, so we skip
    // the DOM queries entirely (C18-02).
    const totalSpending = document.getElementById('stat-total-spending');
    if (hasData && totalSpending) {
      totalSpending.textContent = formatWonStat(opt.totalSpending);

      const totalSavings = document.getElementById('stat-total-savings');
      if (totalSavings) {
        totalSavings.textContent = (opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWonStat(opt.savingsVsSingleCard);
      }

      const cardsNeeded = document.getElementById('stat-cards-needed');
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

    // Cleanup: when the effect re-runs (store changes) and data is cleared,
    // restore the empty state and reset stat elements (C18-01).
    return () => {
      const dataElNow = document.getElementById(dataContentId);
      const emptyElNow = document.getElementById(emptyStateId);
      if (dataElNow) dataElNow.classList.add('hidden');
      if (emptyElNow) emptyElNow.classList.remove('hidden');

      // Reset stat elements to placeholder state
      const ts = document.getElementById('stat-total-spending');
      const tv = document.getElementById('stat-total-savings');
      const cn = document.getElementById('stat-cards-needed');
      const sl = document.getElementById('stat-savings-label');
      if (ts) ts.textContent = '—';
      if (tv) tv.textContent = '—';
      if (cn) cn.textContent = '—';
      if (sl) sl.textContent = '예상 절약액';
    };
  });
</script>
