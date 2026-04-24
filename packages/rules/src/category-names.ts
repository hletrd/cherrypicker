/** Build a Record mapping category IDs (including dot-notation subcategory keys)
 *  to their Korean labels, from the taxonomy CategoryNode tree.
 *
 *  NOTE: This function is not yet wired into consumers. The hardcoded
 *  CATEGORY_NAMES_KO in greedy.ts and FALLBACK_CATEGORY_LABELS in
 *  category-labels.ts must be kept in sync with the taxonomy until
 *  integration is complete (C2-01/C3-01). */

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
