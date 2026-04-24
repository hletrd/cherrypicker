<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatSavingsValue } from '../../lib/formatters.js';

  interface Props {
    dataContentId: string;
    emptyStateId: string;
  }

  let { dataContentId, emptyStateId }: Props = $props();

  // Cached element references — queried once on first effect run, then reused
  // to avoid repeated getElementById calls on every store change. Stale refs
  // (elements removed from DOM during Astro client-side navigation) are
  // re-queried on the next effect run (C21-01).
  let cachedDataEl: HTMLElement | null = null;
  let cachedEmptyEl: HTMLElement | null = null;
  let cachedStatTotalSpending: HTMLElement | null = null;
  let cachedStatTotalSavings: HTMLElement | null = null;
  let cachedStatCardsNeeded: HTMLElement | null = null;
  let cachedStatSavingsLabel: HTMLElement | null = null;
  let originalSavingsLabelText: string | null = null;

  function getOrRefreshElement(
    cached: HTMLElement | null,
    id: string,
  ): HTMLElement | null {
    // If we have a cached ref and it's still in the DOM, reuse it.
    // If it's been removed (Astro View Transition replaced the page),
    // re-query by ID to pick up the new element.
    if (cached && cached.isConnected) return cached;
    const el = document.getElementById(id);
    return el;
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
  // C19-02 fix: The cleanup function uses the same element references
  // captured during the effect body rather than re-querying by ID.
  //
  // C21-01 fix: Element references are cached across effect runs and only
  // re-queried when stale (disconnected from DOM during Astro navigation).
  // This avoids repeated getElementById calls on every store change and
  // prevents populating stale elements during page transitions.
  $effect(() => {
    const opt = analysisStore.result?.optimization;
    const hasData = opt !== undefined;

    // Cache or refresh element references
    cachedDataEl = getOrRefreshElement(cachedDataEl, dataContentId);
    cachedEmptyEl = getOrRefreshElement(cachedEmptyEl, emptyStateId);

    if (cachedDataEl && cachedDataEl.isConnected) cachedDataEl.classList.toggle('hidden', !hasData);
    if (cachedEmptyEl && cachedEmptyEl.isConnected) cachedEmptyEl.classList.toggle('hidden', hasData);

    // Only query stat elements if we have data and a valid data container
    // (i.e., we're on the results page). On the dashboard page these elements
    // don't exist, so we skip the DOM queries entirely (C18-02).
    if (hasData && cachedDataEl) {
      cachedStatTotalSpending = getOrRefreshElement(cachedStatTotalSpending, 'stat-total-spending');
      cachedStatTotalSavings = cachedStatTotalSpending
        ? getOrRefreshElement(cachedStatTotalSavings, 'stat-total-savings')
        : null;
      cachedStatCardsNeeded = cachedStatTotalSpending
        ? getOrRefreshElement(cachedStatCardsNeeded, 'stat-cards-needed')
        : null;
      cachedStatSavingsLabel = cachedStatTotalSpending
        ? getOrRefreshElement(cachedStatSavingsLabel, 'stat-savings-label')
        : null;
    }

    if (hasData && cachedStatTotalSpending) {
      cachedStatTotalSpending.textContent = formatWon(opt.totalSpending);

      if (cachedStatTotalSavings) {
        // Use >= 100 threshold for '+' prefix matching SavingsComparison and ReportContent
        // (C82-03/C84-01). Use Math.abs() when negative to avoid redundant minus under
        // the "추가 비용" label, matching the pattern in SavingsComparison and ReportContent
        // (C83-03/C84-02).
        cachedStatTotalSavings.textContent = formatSavingsValue(opt.savingsVsSingleCard);
      }

      if (cachedStatCardsNeeded) {
        const uniqueCards = new Set(opt.assignments.map((a: { assignedCardId: string }) => a.assignedCardId)).size;
        cachedStatCardsNeeded.textContent = uniqueCards + '장';
      }

      // Capture original label text before any modification (C59-03)
      if (cachedStatSavingsLabel && originalSavingsLabelText === null) {
        originalSavingsLabelText = cachedStatSavingsLabel.textContent;
      }

      // Update savings label to "추가 비용" when cherry-picking is worse
      if (cachedStatSavingsLabel && opt.savingsVsSingleCard < 0) {
        cachedStatSavingsLabel.textContent = '추가 비용';
      }
    }

    // Cleanup: when the effect re-runs (store changes) and data is cleared,
    // restore the empty state and reset stat elements. Using cached refs
    // instead of re-querying by ID prevents cleanup from affecting elements
    // belonging to a new page instance after Astro client-side navigation
    // (C19-02). The isConnected check in getOrRefreshElement ensures stale
    // refs from torn-down pages are not used (C21-01).
    return () => {
      if (cachedDataEl && cachedDataEl.isConnected) cachedDataEl.classList.add('hidden');
      if (cachedEmptyEl && cachedEmptyEl.isConnected) cachedEmptyEl.classList.remove('hidden');

      if (cachedStatTotalSpending && cachedStatTotalSpending.isConnected) cachedStatTotalSpending.textContent = '—';
      if (cachedStatTotalSavings && cachedStatTotalSavings.isConnected) cachedStatTotalSavings.textContent = '—';
      if (cachedStatCardsNeeded && cachedStatCardsNeeded.isConnected) cachedStatCardsNeeded.textContent = '—';
      if (cachedStatSavingsLabel && cachedStatSavingsLabel.isConnected) cachedStatSavingsLabel.textContent = originalSavingsLabelText ?? '예상 절약액';
    };
  });
</script>
