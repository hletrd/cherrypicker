<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import { formatWon, formatSavingsValue } from '../../lib/formatters.js';

  interface Props {
    dataContentId: string;
    emptyStateId: string;
    loadingStateId: string;
    errorStateId: string;
    statusTextId?: string;
    dataControlId?: string;
  }

  let {
    dataContentId,
    emptyStateId,
    loadingStateId,
    errorStateId,
    statusTextId,
    dataControlId,
  }: Props = $props();

  // Cached element references — queried once on first effect run, then reused
  // to avoid repeated getElementById calls on every store change. Stale refs
  // (elements removed from DOM during Astro client-side navigation) are
  // re-queried on the next effect run (C21-01).
  let cachedDataEl: HTMLElement | null = null;
  let cachedEmptyEl: HTMLElement | null = null;
  let cachedLoadingEl: HTMLElement | null = null;
  let cachedErrorEl: HTMLElement | null = null;
  let cachedStatTotalSpending: HTMLElement | null = null;
  let cachedStatTotalSavings: HTMLElement | null = null;
  let cachedStatCardsNeeded: HTMLElement | null = null;
  let cachedStatSavingsLabel: HTMLElement | null = null;
  let cachedStatusText: HTMLElement | null = null;
  let cachedDataControl: HTMLElement | null = null;
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


  // Keep Astro's loading, error, empty, and data shells in lockstep with the
  // shared store. References are cached across effect runs and refreshed after
  // Astro view transitions replace the page.
  $effect(() => {
    const opt = analysisStore.result?.optimization;
    const hasData = opt !== undefined;
    const viewState = hasData
      ? 'data'
      : analysisStore.loading
        ? 'loading'
        : analysisStore.error
          ? 'error'
          : 'empty';

    // Cache or refresh element references
    cachedDataEl = getOrRefreshElement(cachedDataEl, dataContentId);
    cachedEmptyEl = getOrRefreshElement(cachedEmptyEl, emptyStateId);
    cachedLoadingEl = getOrRefreshElement(cachedLoadingEl, loadingStateId);
    cachedErrorEl = getOrRefreshElement(cachedErrorEl, errorStateId);
    if (statusTextId) cachedStatusText = getOrRefreshElement(cachedStatusText, statusTextId);
    if (dataControlId) {
      cachedDataControl = getOrRefreshElement(
        cachedDataControl,
        dataControlId,
      );
    }

    if (cachedDataEl?.isConnected) {
      cachedDataEl.classList.toggle('hidden', viewState !== 'data');
    }
    if (cachedEmptyEl?.isConnected) {
      cachedEmptyEl.classList.toggle('hidden', viewState !== 'empty');
    }
    if (cachedLoadingEl?.isConnected) {
      cachedLoadingEl.classList.toggle('hidden', viewState !== 'loading');
    }
    if (cachedErrorEl?.isConnected) {
      cachedErrorEl.classList.toggle('hidden', viewState !== 'error');
      const message = cachedErrorEl.querySelector<HTMLElement>(
        '[data-analysis-error-message]',
      );
      if (message) {
        message.textContent =
          analysisStore.error ?? '분석 결과를 표시하지 못했어요.';
      }
    }
    if (cachedDataControl?.isConnected) {
      cachedDataControl.toggleAttribute('hidden', !hasData);
      cachedDataControl.toggleAttribute('disabled', !hasData);
    }
    if (cachedStatusText?.isConnected) {
      cachedStatusText.textContent = analysisStore.error && hasData
        ? '결과를 업데이트하지 못해 이전 분석을 표시하고 있어요'
        : analysisStore.loading && hasData
          ? '분석 결과를 다시 계산하는 중이에요'
          : viewState === 'loading'
            ? '분석 결과를 확인하는 중이에요'
            : viewState === 'error'
              ? '분석 결과를 표시하지 못했어요'
              : hasData && (analysisStore.result?.parseErrors.length ?? 0) > 0
                ? '분석 완료 — 확인할 항목 있음'
                : hasData
                  ? '분석이 끝났어요'
                  : '명세서를 올리면 분석 결과를 보여줘요';
    }

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
        // the negative-delta label, matching SavingsComparison and ReportContent
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

      // Describe the unsigned delta without implying net savings or annual-fee treatment.
      if (cachedStatSavingsLabel && opt.savingsVsSingleCard < 0) {
        cachedStatSavingsLabel.textContent =
          '추천 조합의 월간 혜택 부족분 (연회비 차감 전)';
      } else if (cachedStatSavingsLabel) {
        cachedStatSavingsLabel.textContent =
          originalSavingsLabelText ??
          '단일 카드 대비 월간 추가 혜택 (연회비 차감 전)';
      }
    } else {
      if (cachedStatTotalSpending && cachedStatTotalSpending.isConnected) cachedStatTotalSpending.textContent = '—';
      if (cachedStatTotalSavings && cachedStatTotalSavings.isConnected) cachedStatTotalSavings.textContent = '—';
      if (cachedStatCardsNeeded && cachedStatCardsNeeded.isConnected) cachedStatCardsNeeded.textContent = '—';
      if (cachedStatSavingsLabel && cachedStatSavingsLabel.isConnected) {
        cachedStatSavingsLabel.textContent =
          originalSavingsLabelText ??
          '단일 카드 대비 월간 추가 혜택 (연회비 차감 전)';
      }
    }
  });
</script>
