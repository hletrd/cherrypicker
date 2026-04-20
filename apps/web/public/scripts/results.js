// Progressive enhancement: show data content from sessionStorage before
// Svelte island hydrates. The VisibilityToggle Svelte component is the
// authoritative source for both visibility and stat population — this
// inline script only provides a faster initial render from sessionStorage.
// Stat population was removed to eliminate split-brain with the Svelte
// store (C54-01).
document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = sessionStorage.getItem('cherrypicker:analysis');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.optimization) {
        const emptyState = document.getElementById('results-empty-state');
        const dataContent = document.getElementById('results-data-content');
        if (emptyState) emptyState.classList.add('hidden');
        if (dataContent) dataContent.classList.remove('hidden');
      }
    }
  } catch {
    // Ignore malformed persisted state.
  }
});
