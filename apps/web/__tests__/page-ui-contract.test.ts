import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

async function source(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

describe('persisted result route states', () => {
  test('server-renders loading first and exposes loading, error, empty, and data states', async () => {
    const routes = [
      ['dashboard', await source('../src/pages/dashboard.astro')],
      ['results', await source('../src/pages/results.astro')],
      ['report', await source('../src/pages/report.astro')],
    ] as const;

    for (const [name, page] of routes) {
      const loadingId = `id="${name}-loading-state"`;
      const errorId = `id="${name}-error-state"`;
      const emptyId = `id="${name}-empty-state"`;
      const dataId = `id="${name}-data-content"`;

      expect(page).toContain(loadingId);
      expect(page).toContain(errorId);
      expect(page).toContain(emptyId);
      expect(page).toContain(dataId);
      expect(page.indexOf(loadingId)).toBeLessThan(page.indexOf(emptyId));
      expect(page).toMatch(
        new RegExp(`${name}-empty-state" class="hidden\\s`),
      );
      expect(page).toContain(`loadingStateId="${name}-loading-state"`);
      expect(page).toContain(`errorStateId="${name}-error-state"`);
      expect(page).toContain('data-analysis-error-message');
    }

    const visibility = await source(
      '../src/components/ui/VisibilityToggle.svelte',
    );
    expect(visibility).toContain("analysisStore.loading");
    expect(visibility).toContain("analysisStore.error");
    expect(visibility).toContain("viewState !== 'loading'");
    expect(visibility).toContain("viewState !== 'error'");
  });
});

describe('page-level visual and print contracts', () => {
  test('wires explicit unassigned and no-benefit states into every web result sink', async () => {
    const [summary, optimal, savings, report, visibility] = await Promise.all([
      source('../src/components/dashboard/SpendingSummary.svelte'),
      source('../src/components/dashboard/OptimalCardMap.svelte'),
      source('../src/components/dashboard/SavingsComparison.svelte'),
      source('../src/components/report/ReportContent.svelte'),
      source('../src/components/ui/VisibilityToggle.svelte'),
    ]);

    for (const sink of [summary, optimal, savings, report]) {
      expect(sink).toContain('unassignedSpending');
      expect(sink).toContain('unassignedTransactionCount');
      expect(sink).toContain('계산 가능한 양의 혜택');
    }
    expect(optimal).toContain('data-testid="optimal-card-no-benefit"');
    expect(savings).toContain('data-testid="savings-no-benefit"');
    expect(report).toContain('추천 카드 배정이 없습니다');
    expect(visibility).toContain('!opt.bestSingleCard');
    expect(visibility).toContain('계산 가능한 양의 혜택 없음');
  });

  test('uses contrast-safe SpendingSummary foregrounds', async () => {
    const summary = await source(
      '../src/components/dashboard/SpendingSummary.svelte',
    );
    expect(summary).toContain('text-blue-700 dark:text-blue-300');
    expect(summary).toContain('text-amber-700 dark:text-amber-300');
    expect(summary).toContain('text-purple-700 dark:text-purple-300');
    expect(summary).not.toContain('text-blue-400 dark:text-blue-300');
    expect(summary).not.toContain('text-amber-400 dark:text-amber-300');
    expect(summary).not.toContain('text-purple-500 dark:text-purple-400');
  });

  test('hides result-only controls from print and keeps a gross-benefit heading', async () => {
    const [results, optimal, savings] = await Promise.all([
      source('../src/pages/results.astro'),
      source('../src/components/dashboard/OptimalCardMap.svelte'),
      source('../src/components/dashboard/SavingsComparison.svelte'),
    ]);

    expect(results).toMatch(/<!-- Back link -->[\s\S]*?print:hidden/);
    expect(results).toMatch(/<!-- Action buttons -->[\s\S]*?print:hidden/);
    expect(results).toContain(
      '<h2 class="mb-4 text-lg font-bold">연회비 차감 전 월간 총혜택 비교</h2>',
    );
    expect(optimal).toMatch(
      /aria-label="추천 카드 정렬"[\s\S]*?data-print-control/,
    );
    expect(optimal).toContain('font-medium print:hidden">대안</th>');
    expect(optimal).toContain('bg-[var(--color-bg)] print:hidden');
    expect(savings).toMatch(
      /<button[\s\S]*?print:hidden[\s\S]*?aria-controls="card-benefit-breakdown"/,
    );
    expect(savings).toContain(
      'class="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] print:block"',
    );
  });

  test('removes lift affordances from noninteractive feature and dashboard panels', async () => {
    const [css, home, dashboard] = await Promise.all([
      source('../src/app.css'),
      source('../src/pages/index.astro'),
      source('../src/pages/dashboard.astro'),
    ]);
    expect(css).not.toContain('.card-transition');
    expect(home).not.toContain('card-transition');
    expect(dashboard).not.toContain('card-transition');
  });
});

describe('theme control contract', () => {
  test('declares native color schemes and synchronizes both toggle states and action names', async () => {
    const [css, layout, script] = await Promise.all([
      source('../src/app.css'),
      source('../src/layouts/Layout.astro'),
      source('../public/scripts/layout.js'),
    ]);

    expect(css).toMatch(/html\.dark\s*\{[\s\S]*?color-scheme:\s*dark/);
    expect(css).toMatch(/html\s*\{[\s\S]*?color-scheme:\s*light/);
    expect(layout.match(/aria-label="어두운 테마로 전환"/g)).toHaveLength(2);
    expect(layout.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(script).toContain(
      "var actionLabel = isDark ? '밝은 테마로 전환' : '어두운 테마로 전환'",
    );
    expect(script).toContain("button.setAttribute('aria-label', actionLabel)");
    expect(script).toContain(
      "button.setAttribute('aria-pressed', String(isDark))",
    );
  });
});
