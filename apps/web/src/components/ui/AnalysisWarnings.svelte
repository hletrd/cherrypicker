<script lang="ts">
  import { analysisStore } from '../../lib/store.svelte.js';
  import {
    affectedParseWarningFileCount,
    affectedParseWarningItemCount,
    type ParseWarning,
  } from '../../lib/analyzer-helpers.js';

  interface AnalysisWarning extends Partial<ParseWarning> {
    fileName?: string;
    file?: string;
    message: string;
  }

  let expanded = $state(false);
  let warnings = $derived((analysisStore.result?.parseErrors ?? []) as AnalysisWarning[]);
  const warningFileName = (warning: AnalysisWarning) =>
    warning.kind === 'summary'
      ? undefined
      : warning.fileName ?? warning.file;
  const warningLabel = (warning: AnalysisWarning) =>
    warning.kind === 'summary'
      ? '나머지 파싱 경고'
      : warningFileName(warning) ?? '업로드 파일';
  const warningCount = (warning: AnalysisWarning) => {
    const count = warning.count;
    return typeof count === 'number' && Number.isFinite(count) && count > 0
      ? Math.floor(count)
      : 1;
  };
  let affectedFileCount = $derived(
    affectedParseWarningFileCount(
      warnings.map((warning) => ({
        fileName: warningFileName(warning) ?? '',
        kind: warning.kind,
        affectedFileCount: warning.affectedFileCount,
      })),
    ),
  );
  let affectedRowCount = $derived(affectedParseWarningItemCount(warnings));
</script>

{#if warnings.length > 0}
  <section
    class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    aria-labelledby="analysis-warnings-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div role="status" aria-live="polite">
        <h2 id="analysis-warnings-heading" class="font-semibold">분석 완료 — 확인할 항목 있음</h2>
        <p class="mt-1 text-sm">
          {affectedFileCount > 0 ? `${affectedFileCount}개 파일에서 ` : ''}{affectedRowCount}개 항목을 읽지 못했어요.
          읽은 거래 내역만 결과에 반영했어요.
        </p>
      </div>
      <button
        type="button"
        class="print:hidden rounded-lg border border-amber-500 px-3 py-1.5 text-sm font-semibold hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] dark:hover:bg-amber-900"
        aria-expanded={expanded}
        aria-controls="analysis-warning-details"
        onclick={() => (expanded = !expanded)}
      >
        {expanded ? '세부 내용 닫기' : '세부 내용 보기'}
      </button>
    </div>

    <div
      id="analysis-warning-details"
      class="analysis-warning-details mt-3 border-t border-amber-300 pt-3 text-sm dark:border-amber-700 {expanded ? 'block' : 'hidden'} print:block"
    >
      <ul class="list-disc space-y-1 pl-5">
        {#each warnings as warning}
          <li>
            <span class="font-medium">{warningLabel(warning)}</span>
            {#if warning.format}<span> ({warning.format})</span>{/if}
            {#if warning.line !== undefined}<span> · {warning.line}행</span>{/if}
            <span>: {warning.message}</span>
            {#if warningCount(warning) > 1}<span> ({warningCount(warning)}건)</span>{/if}
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}
