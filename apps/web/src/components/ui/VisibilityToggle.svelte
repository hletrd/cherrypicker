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
  // C18-01/C18-02 fix: The effect provides cleanup that restores the
  // empty state when the store is reset, and skips stat-element population
  // when the results page is not mounted (those elements won't exist).
  //
  // C19-02 fix: The cleanup function now uses the same element references
  // captured during the effect body rather than re-querying by ID. This
  // prevents cleanup from accidentally resetting elements that belong to a
  // new page instance after Astro client-side navigation (the old
  // VisibilityToggle's cleanup could race with new page mounts if both
  // pages have elements with the same IDs).
  $effect(() => {
    const opt = analysisStore.result?.optimization;
    const hasData = opt !== undefined;
    const dataEl = document.getElementById(dataContentId);
    const emptyEl = document.getElementById(emptyStateId);
    if (dataEl) dataEl.classList.toggle('hidden', !hasData);
    if (emptyEl) emptyEl.classList.toggle('hidden', hasData);

    // Capture stat element references from this run — cleanup will only
    // reset these exact references, preventing races with new page mounts.
    const totalSpending = document.getElementById('stat-total-spending');
    const totalSavings = hasData && totalSpending ? document.getElementById('stat-total-savings') : null;
    const cardsNeeded = hasData && totalSpending ? document.getElementById('stat-cards-needed') : null;
    const savingsLabel = hasData && totalSpending ? document.getElementById('stat-savings-label') : null;

    // Populate results page summary stats from the store.
    // Only run when the stat elements exist (results page is mounted).
    // On the dashboard page these elements are absent, so we skip
    // the DOM queries entirely (C18-02).
    if (hasData && totalSpending) {
      totalSpending.textContent = formatWonStat(opt.totalSpending);

      if (totalSavings) {
        totalSavings.textContent = (opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWonStat(opt.savingsVsSingleCard);
      }

      if (cardsNeeded) {
        const uniqueCards = new Set(opt.assignments.map((a: { assignedCardId: string }) => a.assignedCardId)).size;
        cardsNeeded.textContent = uniqueCards + '장';
      }

      // Update savings label to "추가 비용" when cherry-picking is worse
      if (savingsLabel && opt.savingsVsSingleCard < 0) {
        savingsLabel.textContent = '추가 비용';
      }
    }

    // Cleanup: when the effect re-runs (store changes) and data is cleared,
    // restore the empty state and reset only the elements captured in this
    // run. Using captured references instead of re-querying by ID prevents
    // cleanup from affecting elements belonging to a new page instance
    // after Astro client-side navigation (C19-02).
    return () => {
      if (dataEl) dataEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');

      // Reset only the elements captured during this effect run
      if (totalSpending) totalSpending.textContent = '—';
      if (totalSavings) totalSavings.textContent = '—';
      if (cardsNeeded) cardsNeeded.textContent = '—';
      if (savingsLabel) savingsLabel.textContent = '예상 절약액';
    };
  });
</script>
