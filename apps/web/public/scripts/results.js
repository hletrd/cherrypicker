document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = sessionStorage.getItem('cherrypicker:analysis');
    if (raw) {
      const data = JSON.parse(raw);
      const opt = data.optimization;
      if (opt) {
        const formatWon = (amount) => Number.isFinite(amount) ? amount.toLocaleString('ko-KR') + '원' : '0원';
        const totalSpending = document.getElementById('stat-total-spending');
        const totalSavings = document.getElementById('stat-total-savings');
        const cardsNeeded = document.getElementById('stat-cards-needed');

        if (totalSpending) totalSpending.textContent = formatWon(opt.totalSpending);
        if (totalSavings) totalSavings.textContent = '+' + formatWon(opt.savingsVsSingleCard);
        if (cardsNeeded) {
          const uniqueCards = new Set(opt.assignments.map((assignment) => assignment.assignedCardId)).size;
          cardsNeeded.textContent = uniqueCards + '장';
        }

        // Show data content, hide empty state
        const emptyState = document.getElementById('results-empty-state');
        const dataContent = document.getElementById('results-data-content');
        if (emptyState) emptyState.classList.add('hidden');
        if (dataContent) dataContent.classList.remove('hidden');
      }
    }
  } catch {
    // Ignore malformed persisted state.
  }

  document.getElementById('download-report')?.addEventListener('click', () => window.print());
});
