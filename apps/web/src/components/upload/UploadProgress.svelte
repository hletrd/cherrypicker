<script lang="ts">
  interface Props {
    progress: number;
    stage: string;
  }

  let { progress, stage }: Props = $props();

  const stages: Record<string, string> = {
    uploading: '파일 업로드 중',
    detecting: '형식 감지 중',
    parsing: '명세서 파싱 중',
    categorizing: '카테고리 분류 중',
    calculating: '혜택 계산 중',
    optimizing: '최적화 중',
    done: '완료',
  };
</script>

<div class="flex flex-col gap-2">
  <div class="flex justify-between text-sm">
    <span>{stages[stage] ?? stage}</span>
    <span class="text-[var(--color-text-muted)]">{Math.round(progress)}%</span>
  </div>
  <div class="h-2 overflow-hidden rounded-full bg-gray-200">
    <div
      class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
      style="width: {progress}%"
    ></div>
  </div>
</div>
