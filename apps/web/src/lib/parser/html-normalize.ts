/**
 * Strip dangerous content and repair malformed table closing tags before
 * SheetJS parsing. Running script removal to a fixed point handles nested or
 * malformed tags that a single replacement can expose.
 */
export function normalizeHTML(html: string): string {
  let cleaned = html;
  while (/<script[\s\S]*?<\/script>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
  }
  return cleaned
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`)/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
    .replace(/\s*(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s"'>]*)/gi, '')
    .replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>')
    .replace(/<\/([a-z][a-z0-9]*)\s+>/gi, '</$1>');
}
