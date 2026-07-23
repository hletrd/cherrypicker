import { safeExternalUrl } from '@cherrypicker/rules/security';

export interface ExternalSourceLink {
  href: string;
  hostname: string;
}

/**
 * Guard catalog data at the last boundary before it becomes a reviewed source
 * link. The returned hostname is derived only after the shared URL validator
 * accepts the href, so components never parse raw catalog input.
 */
export function safeExternalSourceLink(
  value: unknown,
): ExternalSourceLink | undefined {
  const href = safeExternalUrl(value);
  if (href === undefined) return undefined;

  const hostname = new URL(href).hostname.replace(/\.$/, '');
  if (hostname.length === 0) return undefined;
  return { href, hostname };
}
