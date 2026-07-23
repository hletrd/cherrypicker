<script lang="ts">
  import { formatIssuerNameKo, getIssuerColor } from '../../lib/formatters.js';

  interface Props {
    issuer: string;
    label?: string;
    compact?: boolean;
  }

  let { issuer, label, compact = false }: Props = $props();
</script>

<span
  data-testid="issuer-badge"
  class="inline-flex w-fit max-w-full items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]
    {compact ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-2.5 py-1 text-sm'}"
>
  <span
    class="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
    style={`background-color: ${getIssuerColor(issuer)}`}
    aria-hidden="true"
  ></span>
  <span class="truncate">{label ?? formatIssuerNameKo(issuer)}</span>
</span>
