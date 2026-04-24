/** Build a Record mapping category IDs (including dot-notation subcategory keys)
 *  to their Korean labels, from the taxonomy CategoryNode tree. Used by
 *  CLI/standalone consumers that don't have a web-side categoryLabels Map
 *  but still need Korean category names in their output (A1-01).
 *
 *  This is the authoritative source — the hardcoded CATEGORY_NAMES_KO in
 *  greedy.ts is a fallback that must be kept in sync with this function. */

import type { CategoryNode } from './types.js';

export function buildCategoryNamesKo(nodes: CategoryNode[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const node of nodes) {
    names[node.id] = node.labelKo;
    if (node.subcategories) {
      for (const sub of node.subcategories) {
        names[`${node.id}.${sub.id}`] = sub.labelKo;
      }
    }
  }
  return names;
}
