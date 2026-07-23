import { safeExternalUrl } from '@cherrypicker/rules/security';

/**
 * Guard catalog data at the last boundary before it becomes an external href.
 * Publication validation should reject unsafe values, but runtime JSON remains
 * untrusted and must fail closed as well.
 */
export function safeExternalHref(value: unknown): string | undefined {
  return safeExternalUrl(value);
}
