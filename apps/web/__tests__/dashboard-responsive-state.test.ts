import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

describe('dashboard responsive and disclosure wiring', () => {
  test('top-row columns wait for the measured 1100px minimum', async () => {
    const source = await readFile(
      new URL('../src/pages/dashboard.astro', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      'grid grid-cols-1 gap-6 min-[1100px]:grid-cols-2',
    );
    expect(source).not.toContain(
      'grid grid-cols-1 gap-6 md:grid-cols-2',
    );
  });

  test('category activation state is independent from hover/focus emphasis', async () => {
    const source = await readFile(
      new URL(
        '../src/components/dashboard/CategoryBreakdown.svelte',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toContain(
      'let expandedIndex = $state<number | null>(null)',
    );
    expect(source).toContain('aria-expanded={expandedIndex === i}');
    expect(source).toContain(
      'onclick={() => (expandedIndex = expandedIndex === i ? null : i)}',
    );
    expect(source).toContain(
      "{expandedIndex === i ? 'block' : 'hidden'}",
    );
    expect(source).toContain('onfocusin={() => (focusedIndex = i)}');
    expect(source).not.toContain('aria-expanded={hoveredIndex === i}');
  });

  test('category spending views use canonical spending instead of reward assignments', async () => {
    const [breakdown, summary, dashboard] = await Promise.all([
      readFile(
        new URL(
          '../src/components/dashboard/CategoryBreakdown.svelte',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../src/components/dashboard/SpendingSummary.svelte',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/dashboard.astro', import.meta.url),
        'utf8',
      ),
    ]);

    expect(dashboard).toContain('data-testid="category-breakdown-panel"');
    expect(breakdown).not.toContain('data-testid="category-breakdown-panel"');
    expect(breakdown).toContain('analysisStore.result?.categoryBreakdown');
    expect(breakdown).not.toContain('analysisStore.assignments');
    expect(summary).toContain('analysisStore.result.categoryBreakdown');
  });
});
