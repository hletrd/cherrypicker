document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = sessionStorage.getItem('cherrypicker:analysis');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.optimization) {
        const emptyState = document.getElementById('dashboard-empty-state');
        const dataContent = document.getElementById('dashboard-data-content');
        if (emptyState) emptyState.classList.add('hidden');
        if (dataContent) dataContent.classList.remove('hidden');
      }
    }
  } catch {
    // Ignore malformed persisted state.
  }
});
